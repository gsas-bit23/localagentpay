//! LocalAgentPay escrow contract.
//!
//! * Merchants register a NEAR account, a location and a small price list.
//! * Users fund a budget with a NEP-141 token (USDC) through `ft_transfer_call`.
//! * Users authorize one agent account with on-chain limits: per-order cap, daily cap,
//!   expiry and an optional merchant allow-list. The agent signs `agent_pay` with a
//!   function-call access key, which cannot attach deposits, so it can never move funds
//!   except through this contract and inside these limits.
//! * Every payment is escrowed. The merchant confirms (funds released) or refunds; the
//!   payer can reclaim after the order deadline. Every step emits a NEP-297 event.
use near_contract_standards::fungible_token::core::ext_ft_core;
use near_contract_standards::fungible_token::receiver::FungibleTokenReceiver;
use near_sdk::json_types::U128;
use near_sdk::serde_json::{self, json};
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise,
    PromiseError, PromiseOrValue,
};

const DAY_MS: u64 = 86_400_000;
const GAS_FT_TRANSFER: Gas = Gas::from_tgas(10);
const GAS_CALLBACK: Gas = Gas::from_tgas(10);
const MAX_ITEMS: usize = 12;
const MAX_TEXT: usize = 120;

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum Key {
    Merchants,
    Budgets,
    Orders,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Item {
    pub name: String,
    pub price: U128,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Merchant {
    pub account_id: AccountId,
    pub name: String,
    pub category: String,
    pub city: String,
    pub lat_e6: i64,
    pub lon_e6: i64,
    pub items: Vec<Item>,
    pub active: bool,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default)]
pub struct AgentPolicy {
    pub agent: Option<AccountId>,
    pub per_order_cap: U128,
    pub daily_cap: U128,
    pub expires_at_ms: u64,
    /// Empty means any registered, active merchant.
    pub allowed_merchants: Vec<AccountId>,
    pub spent_today: U128,
    pub day_index: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default)]
pub struct Budget {
    pub balance: U128,
    pub escrowed: U128,
    pub policy: AgentPolicy,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum OrderStatus {
    Escrowed,
    Releasing,
    Confirmed,
    Refunded,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Order {
    pub id: u64,
    pub payer: AccountId,
    pub merchant: AccountId,
    pub amount: U128,
    pub memo: String,
    pub via_agent: Option<AccountId>,
    pub status: OrderStatus,
    pub created_at_ms: u64,
    pub deadline_ms: u64,
}

#[near(serializers = [json])]
pub struct Config {
    pub owner: AccountId,
    pub token: AccountId,
    pub order_timeout_ms: u64,
    pub next_order_id: u64,
    pub merchant_count: u32,
}

#[derive(PanicOnDefault)]
#[near(contract_state)]
pub struct Contract {
    owner: AccountId,
    token: AccountId,
    order_timeout_ms: u64,
    next_order_id: u64,
    merchants: IterableMap<AccountId, Merchant>,
    budgets: LookupMap<AccountId, Budget>,
    orders: IterableMap<u64, Order>,
}

fn emit(event: &str, data: serde_json::Value) {
    env::log_str(&format!(
        "EVENT_JSON:{}",
        json!({"standard": "localagentpay", "version": "1.0.0", "event": event, "data": [data]})
    ));
}

fn clean(text: &str, field: &str) -> String {
    let t = text.trim();
    require!(!t.is_empty() && t.len() <= MAX_TEXT, format!("{field} must be 1..={MAX_TEXT} chars"));
    t.to_string()
}

#[near(serializers = [json])]
#[serde(tag = "action", rename_all = "snake_case")]
enum TransferMsg {
    Fund,
    Pay { merchant: AccountId, memo: String },
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner: AccountId, token: AccountId, order_timeout_ms: Option<u64>) -> Self {
        Self {
            owner,
            token,
            order_timeout_ms: order_timeout_ms.unwrap_or(10 * 60 * 1000),
            next_order_id: 1,
            merchants: IterableMap::new(Key::Merchants),
            budgets: LookupMap::new(Key::Budgets),
            orders: IterableMap::new(Key::Orders),
        }
    }

    // ---------- merchants ----------

    /// The caller becomes (or updates) a merchant. Prices are in token base units.
    pub fn register_merchant(
        &mut self,
        name: String,
        category: String,
        city: String,
        lat_e6: i64,
        lon_e6: i64,
        items: Vec<Item>,
    ) {
        let account_id = env::predecessor_account_id();
        require!(items.len() <= MAX_ITEMS, "Too many items");
        let items: Vec<Item> = items
            .into_iter()
            .map(|i| {
                require!(i.price.0 > 0, "Item price must be positive");
                Item { name: clean(&i.name, "item name"), price: i.price }
            })
            .collect();
        require!(lat_e6.abs() <= 90_000_000 && lon_e6.abs() <= 180_000_000, "Bad coordinates");
        let merchant = Merchant {
            account_id: account_id.clone(),
            name: clean(&name, "name"),
            category: clean(&category, "category"),
            city: clean(&city, "city"),
            lat_e6,
            lon_e6,
            items,
            active: true,
        };
        emit("merchant_registered", json!({"merchant": account_id, "name": merchant.name, "city": merchant.city}));
        self.merchants.insert(account_id, merchant);
    }

    pub fn set_merchant_active(&mut self, active: bool) {
        let id = env::predecessor_account_id();
        let m = self.merchants.get_mut(&id).unwrap_or_else(|| env::panic_str("Not a merchant"));
        m.active = active;
        emit("merchant_status", json!({"merchant": id, "active": active}));
    }

    // ---------- budgets & agent policy ----------

    pub fn set_agent_policy(
        &mut self,
        agent: AccountId,
        per_order_cap: U128,
        daily_cap: U128,
        expires_in_ms: u64,
        allowed_merchants: Option<Vec<AccountId>>,
    ) {
        let user = env::predecessor_account_id();
        require!(agent != user, "Agent must be a different account");
        require!(per_order_cap.0 > 0 && per_order_cap.0 <= daily_cap.0, "Need 0 < per-order cap <= daily cap");
        require!(expires_in_ms > 0 && expires_in_ms <= 30 * DAY_MS, "Expiry must be within 30 days");
        let allowed = allowed_merchants.unwrap_or_default();
        require!(allowed.len() <= 20, "At most 20 allowed merchants");
        let now = env::block_timestamp_ms();
        let budget = self.budgets.entry(user.clone()).or_default();
        let (spent, day) = if budget.policy.day_index == now / DAY_MS {
            (budget.policy.spent_today, budget.policy.day_index)
        } else {
            (U128(0), now / DAY_MS)
        };
        budget.policy = AgentPolicy {
            agent: Some(agent.clone()),
            per_order_cap,
            daily_cap,
            expires_at_ms: now + expires_in_ms,
            allowed_merchants: allowed.clone(),
            spent_today: spent,
            day_index: day,
        };
        emit("agent_policy_set", json!({
            "user": user, "agent": agent, "per_order_cap": per_order_cap,
            "daily_cap": daily_cap, "expires_at_ms": now + expires_in_ms, "allowed_merchants": allowed
        }));
    }

    pub fn revoke_agent(&mut self) {
        let user = env::predecessor_account_id();
        if let Some(b) = self.budgets.get_mut(&user) {
            b.policy.agent = None;
        }
        emit("agent_revoked", json!({"user": user}));
    }

    /// Called by the authorized agent account (function-call key, no deposit).
    pub fn agent_pay(&mut self, user: AccountId, merchant: AccountId, amount: U128, memo: String) -> u64 {
        let agent = env::predecessor_account_id();
        let now = env::block_timestamp_ms();
        let m = self.active_merchant(&merchant);
        let budget = self.budgets.get_mut(&user).unwrap_or_else(|| env::panic_str("No budget for this user"));
        let p = &mut budget.policy;
        require!(p.agent.as_ref() == Some(&agent), "Caller is not this user's authorized agent");
        require!(now < p.expires_at_ms, "Agent authorization expired");
        require!(p.allowed_merchants.is_empty() || p.allowed_merchants.contains(&m), "Merchant not allowed by the user's policy");
        require!(amount.0 > 0 && amount.0 <= p.per_order_cap.0, "Amount exceeds the per-order cap");
        if p.day_index != now / DAY_MS {
            p.day_index = now / DAY_MS;
            p.spent_today = U128(0);
        }
        require!(p.spent_today.0 + amount.0 <= p.daily_cap.0, "Amount exceeds the remaining daily cap");
        p.spent_today = U128(p.spent_today.0 + amount.0);
        self.open_order(user, m, amount, memo, Some(agent))
    }

    /// The user pays a merchant from their own budget (no agent involved).
    pub fn pay_from_budget(&mut self, merchant: AccountId, amount: U128, memo: String) -> u64 {
        let user = env::predecessor_account_id();
        let m = self.active_merchant(&merchant);
        require!(amount.0 > 0, "Amount must be positive");
        self.open_order(user, m, amount, memo, None)
    }

    /// Withdraws unescrowed budget back to the user's wallet.
    pub fn withdraw_budget(&mut self, amount: U128) -> Promise {
        let user = env::predecessor_account_id();
        let b = self.budgets.get_mut(&user).unwrap_or_else(|| env::panic_str("No budget"));
        require!(amount.0 > 0 && amount.0 <= b.balance.0, "Insufficient available budget");
        b.balance = U128(b.balance.0 - amount.0);
        ext_ft_core::ext(self.token.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_FT_TRANSFER)
            .ft_transfer(user.clone(), amount, Some("LocalAgentPay budget withdrawal".into()))
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_CALLBACK).on_withdraw(user, amount))
    }

    #[private]
    pub fn on_withdraw(&mut self, user: AccountId, amount: U128, #[callback_result] r: Result<(), PromiseError>) -> bool {
        if r.is_ok() {
            emit("budget_withdrawn", json!({"user": user, "amount": amount}));
            true
        } else {
            let b = self.budgets.entry(user).or_default();
            b.balance = U128(b.balance.0 + amount.0);
            false
        }
    }

    // ---------- order lifecycle ----------

    /// Merchant confirms fulfilment; escrow is released to the merchant.
    pub fn confirm(&mut self, order_id: u64) -> Promise {
        let caller = env::predecessor_account_id();
        let o = self.orders.get_mut(&order_id).unwrap_or_else(|| env::panic_str("Unknown order"));
        require!(o.merchant == caller, "Only the merchant can confirm");
        require!(o.status == OrderStatus::Escrowed, "Order is not escrowed");
        o.status = OrderStatus::Releasing;
        let (merchant, amount) = (o.merchant.clone(), o.amount);
        ext_ft_core::ext(self.token.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_FT_TRANSFER)
            .ft_transfer(merchant, amount, Some(format!("LocalAgentPay order {order_id}")))
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_CALLBACK).on_release(order_id))
    }

    #[private]
    pub fn on_release(&mut self, order_id: u64, #[callback_result] r: Result<(), PromiseError>) -> bool {
        let o = self.orders.get_mut(&order_id).expect("order");
        if r.is_ok() {
            o.status = OrderStatus::Confirmed;
            let (payer, amount, merchant) = (o.payer.clone(), o.amount, o.merchant.clone());
            let b = self.budgets.get_mut(&payer).expect("budget");
            b.escrowed = U128(b.escrowed.0 - amount.0);
            emit("order_confirmed", json!({"order_id": order_id, "merchant": merchant, "payer": payer, "amount": amount}));
            true
        } else {
            o.status = OrderStatus::Escrowed;
            emit("order_release_failed", json!({"order_id": order_id}));
            false
        }
    }

    /// Merchant may refund at any time; the payer may reclaim after the deadline.
    pub fn refund(&mut self, order_id: u64) {
        let caller = env::predecessor_account_id();
        let now = env::block_timestamp_ms();
        let o = self.orders.get_mut(&order_id).unwrap_or_else(|| env::panic_str("Unknown order"));
        require!(o.status == OrderStatus::Escrowed, "Order is not escrowed");
        let by_merchant = caller == o.merchant;
        require!(by_merchant || (caller == o.payer && now >= o.deadline_ms),
            "Only the merchant, or the payer after the deadline, can refund");
        o.status = OrderStatus::Refunded;
        let (payer, amount) = (o.payer.clone(), o.amount);
        let b = self.budgets.get_mut(&payer).expect("budget");
        b.escrowed = U128(b.escrowed.0 - amount.0);
        b.balance = U128(b.balance.0 + amount.0);
        emit("order_refunded", json!({"order_id": order_id, "payer": payer, "amount": amount, "by": caller}));
    }

    // ---------- views ----------

    pub fn get_config(&self) -> Config {
        Config {
            owner: self.owner.clone(),
            token: self.token.clone(),
            order_timeout_ms: self.order_timeout_ms,
            next_order_id: self.next_order_id,
            merchant_count: self.merchants.len(),
        }
    }

    pub fn get_merchants(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<Merchant> {
        self.merchants
            .values()
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50).min(100) as usize)
            .cloned()
            .collect()
    }

    pub fn get_merchant(&self, account_id: AccountId) -> Option<Merchant> {
        self.merchants.get(&account_id).cloned()
    }

    pub fn get_budget(&self, account_id: AccountId) -> Budget {
        self.budgets.get(&account_id).cloned().unwrap_or_default()
    }

    pub fn get_order(&self, order_id: u64) -> Option<Order> {
        self.orders.get(&order_id).cloned()
    }

    /// Newest first; filters by payer or merchant.
    pub fn get_orders_for(&self, account_id: AccountId, limit: Option<u32>) -> Vec<Order> {
        let limit = limit.unwrap_or(25).min(100) as usize;
        let mut out = Vec::new();
        let mut id = self.next_order_id;
        while id > 1 && out.len() < limit {
            id -= 1;
            if let Some(o) = self.orders.get(&id) {
                if o.payer == account_id || o.merchant == account_id {
                    out.push(o.clone());
                }
            }
        }
        out
    }

    // ---------- internal ----------

    fn active_merchant(&self, merchant: &AccountId) -> AccountId {
        let m = self.merchants.get(merchant).unwrap_or_else(|| env::panic_str("Merchant is not registered"));
        require!(m.active, "Merchant is paused");
        merchant.clone()
    }

    fn open_order(&mut self, payer: AccountId, merchant: AccountId, amount: U128, memo: String, via_agent: Option<AccountId>) -> u64 {
        let memo = clean(&memo, "memo");
        let b = self.budgets.get_mut(&payer).unwrap_or_else(|| env::panic_str("No budget for this user"));
        require!(amount.0 <= b.balance.0, "Insufficient budget balance");
        b.balance = U128(b.balance.0 - amount.0);
        b.escrowed = U128(b.escrowed.0 + amount.0);
        self.insert_order(payer, merchant, amount, memo, via_agent)
    }

    fn insert_order(&mut self, payer: AccountId, merchant: AccountId, amount: U128, memo: String, via_agent: Option<AccountId>) -> u64 {
        let id = self.next_order_id;
        self.next_order_id += 1;
        let now = env::block_timestamp_ms();
        let order = Order {
            id,
            payer: payer.clone(),
            merchant: merchant.clone(),
            amount,
            memo: memo.clone(),
            via_agent: via_agent.clone(),
            status: OrderStatus::Escrowed,
            created_at_ms: now,
            deadline_ms: now + self.order_timeout_ms,
        };
        self.orders.insert(id, order);
        emit("order_created", json!({
            "order_id": id, "payer": payer, "merchant": merchant, "amount": amount,
            "memo": memo, "via_agent": via_agent
        }));
        id
    }
}

#[near]
impl FungibleTokenReceiver for Contract {
    /// msg: {"action":"fund"} adds to the sender's budget;
    /// {"action":"pay","merchant":"shop.testnet","memo":"..."} escrows a direct payment.
    fn ft_on_transfer(&mut self, sender_id: AccountId, amount: U128, msg: String) -> PromiseOrValue<U128> {
        require!(env::predecessor_account_id() == self.token, "Unsupported token");
        let parsed: TransferMsg = serde_json::from_str(&msg).unwrap_or_else(|_| env::panic_str("Invalid msg"));
        let b = self.budgets.entry(sender_id.clone()).or_default();
        b.balance = U128(b.balance.0 + amount.0);
        emit("budget_funded", json!({"user": sender_id, "amount": amount}));
        if let TransferMsg::Pay { merchant, memo } = parsed {
            let m = self.active_merchant(&merchant);
            self.open_order(sender_id, m, amount, memo, None);
        }
        PromiseOrValue::Value(U128(0))
    }
}

#[cfg(test)]
mod tests;
