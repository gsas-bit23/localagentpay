use super::*;
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::testing_env;

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}

fn ctx(predecessor: &str, now_ms: u64) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(acc("lap.testnet"))
        .predecessor_account_id(acc(predecessor))
        .block_timestamp(now_ms * 1_000_000)
        .build());
}

const T0: u64 = 1_800_000_000_000;

fn setup() -> Contract {
    ctx("owner.testnet", T0);
    let mut c = Contract::new(acc("owner.testnet"), acc("usdc.testnet"), Some(60_000));
    ctx("bakery.testnet", T0);
    c.register_merchant(
        "Bakery".into(), "groceries".into(), "Karachi".into(), 24_860_700, 67_001_100,
        vec![Item { name: "Bread".into(), price: U128(2_000_000) }],
    );
    ctx("usdc.testnet", T0);
    let _ = c.ft_on_transfer(acc("alice.testnet"), U128(50_000_000), r#"{"action":"fund"}"#.into());
    c
}

fn policy(c: &mut Contract) {
    ctx("alice.testnet", T0);
    c.set_agent_policy(acc("agent.testnet"), U128(10_000_000), U128(15_000_000), 3_600_000, None);
}

#[test]
fn fund_and_view() {
    let c = setup();
    assert_eq!(c.get_budget(acc("alice.testnet")).balance.0, 50_000_000);
    assert_eq!(c.get_merchants(None, None).len(), 1);
    assert!(get_logs().iter().any(|l| l.contains("budget_funded")));
}

#[test]
fn agent_pays_within_limits_and_merchant_confirms() {
    let mut c = setup();
    policy(&mut c);
    ctx("agent.testnet", T0 + 1);
    let id = c.agent_pay(acc("alice.testnet"), acc("bakery.testnet"), U128(8_000_000), "2 bread".into());
    let b = c.get_budget(acc("alice.testnet"));
    assert_eq!((b.balance.0, b.escrowed.0, b.policy.spent_today.0), (42_000_000, 8_000_000, 8_000_000));
    assert_eq!(c.get_order(id).unwrap().via_agent, Some(acc("agent.testnet")));
    ctx("bakery.testnet", T0 + 2);
    let _ = c.confirm(id);
    assert_eq!(c.get_order(id).unwrap().status, OrderStatus::Releasing);
}

#[test]
#[should_panic(expected = "per-order cap")]
fn agent_per_order_cap() {
    let mut c = setup();
    policy(&mut c);
    ctx("agent.testnet", T0 + 1);
    c.agent_pay(acc("alice.testnet"), acc("bakery.testnet"), U128(11_000_000), "too much".into());
}

#[test]
#[should_panic(expected = "daily cap")]
fn agent_daily_cap() {
    let mut c = setup();
    policy(&mut c);
    ctx("agent.testnet", T0 + 1);
    c.agent_pay(acc("alice.testnet"), acc("bakery.testnet"), U128(10_000_000), "one".into());
    c.agent_pay(acc("alice.testnet"), acc("bakery.testnet"), U128(6_000_000), "two".into());
}

#[test]
fn daily_cap_resets_next_day() {
    let mut c = setup();
    ctx("alice.testnet", T0);
    c.set_agent_policy(acc("agent.testnet"), U128(10_000_000), U128(10_000_000), 3 * DAY_MS, None);
    ctx("agent.testnet", T0 + 1);
    c.agent_pay(acc("alice.testnet"), acc("bakery.testnet"), U128(10_000_000), "day one".into());
    ctx("agent.testnet", T0 + DAY_MS + 1);
    c.agent_pay(acc("alice.testnet"), acc("bakery.testnet"), U128(10_000_000), "day two".into());
    assert_eq!(c.get_budget(acc("alice.testnet")).escrowed.0, 20_000_000);
}

#[test]
#[should_panic(expected = "not this user's authorized agent")]
fn stranger_cannot_spend() {
    let mut c = setup();
    policy(&mut c);
    ctx("mallory.testnet", T0 + 1);
    c.agent_pay(acc("alice.testnet"), acc("bakery.testnet"), U128(1), "steal".into());
}

#[test]
#[should_panic(expected = "expired")]
fn expired_policy() {
    let mut c = setup();
    policy(&mut c);
    ctx("agent.testnet", T0 + 3_600_001);
    c.agent_pay(acc("alice.testnet"), acc("bakery.testnet"), U128(1), "late".into());
}

#[test]
#[should_panic(expected = "not this user's authorized agent")]
fn revoked_agent() {
    let mut c = setup();
    policy(&mut c);
    ctx("alice.testnet", T0 + 1);
    c.revoke_agent();
    ctx("agent.testnet", T0 + 2);
    c.agent_pay(acc("alice.testnet"), acc("bakery.testnet"), U128(1), "after revoke".into());
}

#[test]
#[should_panic(expected = "Merchant not allowed")]
fn allow_list_enforced() {
    let mut c = setup();
    ctx("shop.testnet", T0);
    c.register_merchant("Shop".into(), "shops".into(), "Karachi".into(), 0, 0, vec![]);
    ctx("alice.testnet", T0);
    c.set_agent_policy(acc("agent.testnet"), U128(5), U128(5), 1000, Some(vec![acc("bakery.testnet")]));
    ctx("agent.testnet", T0 + 1);
    c.agent_pay(acc("alice.testnet"), acc("shop.testnet"), U128(1), "x".into());
}

#[test]
#[should_panic(expected = "not registered")]
fn unknown_merchant() {
    let mut c = setup();
    policy(&mut c);
    ctx("agent.testnet", T0 + 1);
    c.agent_pay(acc("alice.testnet"), acc("nobody.testnet"), U128(1), "x".into());
}

#[test]
fn merchant_refund_returns_budget() {
    let mut c = setup();
    ctx("alice.testnet", T0);
    let id = c.pay_from_budget(acc("bakery.testnet"), U128(5_000_000), "cake".into());
    ctx("bakery.testnet", T0 + 5);
    c.refund(id);
    let b = c.get_budget(acc("alice.testnet"));
    assert_eq!((b.balance.0, b.escrowed.0), (50_000_000, 0));
    assert_eq!(c.get_order(id).unwrap().status, OrderStatus::Refunded);
}

#[test]
#[should_panic(expected = "after the deadline")]
fn payer_cannot_reclaim_early() {
    let mut c = setup();
    ctx("alice.testnet", T0);
    let id = c.pay_from_budget(acc("bakery.testnet"), U128(5_000_000), "cake".into());
    ctx("alice.testnet", T0 + 59_000);
    c.refund(id);
}

#[test]
fn payer_reclaims_after_deadline() {
    let mut c = setup();
    ctx("alice.testnet", T0);
    let id = c.pay_from_budget(acc("bakery.testnet"), U128(5_000_000), "cake".into());
    ctx("alice.testnet", T0 + 60_000);
    c.refund(id);
    assert_eq!(c.get_budget(acc("alice.testnet")).balance.0, 50_000_000);
}

#[test]
fn direct_pay_via_ft_transfer_call() {
    let mut c = setup();
    ctx("usdc.testnet", T0);
    let _ = c.ft_on_transfer(acc("bob.testnet"), U128(3_000_000), r#"{"action":"pay","merchant":"bakery.testnet","memo":"bread"}"#.into());
    let orders = c.get_orders_for(acc("bob.testnet"), None);
    assert_eq!(orders.len(), 1);
    assert_eq!(c.get_budget(acc("bob.testnet")).escrowed.0, 3_000_000);
}

#[test]
#[should_panic(expected = "Unsupported token")]
fn rejects_other_tokens() {
    let mut c = setup();
    ctx("fake-usdc.testnet", T0);
    let _ = c.ft_on_transfer(acc("bob.testnet"), U128(3), r#"{"action":"fund"}"#.into());
}

#[test]
#[should_panic(expected = "Only the merchant can confirm")]
fn payer_cannot_confirm() {
    let mut c = setup();
    ctx("alice.testnet", T0);
    let id = c.pay_from_budget(acc("bakery.testnet"), U128(1), "x".into());
    let _ = c.confirm(id);
}

#[test]
#[should_panic(expected = "Insufficient budget")]
fn cannot_overspend_budget() {
    let mut c = setup();
    ctx("alice.testnet", T0);
    c.pay_from_budget(acc("bakery.testnet"), U128(50_000_001), "x".into());
}
