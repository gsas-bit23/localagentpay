//! Testnet-only USDC stand-in for LocalAgentPay demos.
//! Six decimals like Circle USDC. Anyone may call `faucet` for up to 100 test USDC per call,
//! and storage registration is paid by the contract so gasless guests can receive tokens.
//! Never deploy this to mainnet: mainnet uses the real NEP-141 USDC
//! (17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1).
use near_contract_standards::fungible_token::metadata::{
    FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC,
};
use near_contract_standards::fungible_token::{
    FungibleToken, FungibleTokenCore, FungibleTokenResolver,
};
use near_contract_standards::storage_management::{
    StorageBalance, StorageBalanceBounds, StorageManagement,
};
use near_sdk::borsh::BorshSerialize;
use near_sdk::collections::LazyOption;
use near_sdk::json_types::U128;
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, PromiseOrValue,
};

pub const FAUCET_MAX: u128 = 100_000_000; // 100 test USDC

#[derive(BorshSerialize, BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    FungibleToken,
    Metadata,
}

#[derive(PanicOnDefault)]
#[near(contract_state)]
pub struct Contract {
    token: FungibleToken,
    metadata: LazyOption<FungibleTokenMetadata>,
}

#[near]
impl Contract {
    #[init]
    pub fn new() -> Self {
        let metadata = FungibleTokenMetadata {
            spec: FT_METADATA_SPEC.to_string(),
            name: "Test USDC (LocalAgentPay testnet)".to_string(),
            symbol: "tUSDC".to_string(),
            icon: None,
            reference: None,
            reference_hash: None,
            decimals: 6,
        };
        Self {
            token: FungibleToken::new(StorageKey::FungibleToken),
            metadata: LazyOption::new(StorageKey::Metadata, Some(&metadata)),
        }
    }

    /// Registers an account for free (the contract pays storage). Testnet convenience.
    pub fn register(&mut self, account_id: AccountId) {
        if self.token.accounts.get(&account_id).is_none() {
            self.token.internal_register_account(&account_id);
        }
    }

    /// Mints up to 100 test USDC to the caller, registering it first if needed.
    pub fn faucet(&mut self, amount: U128) -> U128 {
        require!(amount.0 > 0 && amount.0 <= FAUCET_MAX, "Faucet amount must be 1..=100 tUSDC");
        let account = env::predecessor_account_id();
        self.register(account.clone());
        self.token.internal_deposit(&account, amount.0);
        near_contract_standards::fungible_token::events::FtMint {
            owner_id: &account,
            amount,
            memo: Some("testnet faucet"),
        }
        .emit();
        self.token.ft_balance_of(account)
    }
}

#[near]
impl FungibleTokenCore for Contract {
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        self.token.ft_transfer(receiver_id, amount, memo)
    }

    #[payable]
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128> {
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }

    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenResolver for Contract {
    #[private]
    fn ft_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
    ) -> U128 {
        let (used, _burned) =
            self.token
                .internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        used.into()
    }
}

#[near]
impl StorageManagement for Contract {
    #[payable]
    fn storage_deposit(
        &mut self,
        account_id: Option<AccountId>,
        registration_only: Option<bool>,
    ) -> StorageBalance {
        self.token.storage_deposit(account_id, registration_only)
    }

    #[payable]
    fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance {
        self.token.storage_withdraw(amount)
    }

    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        self.token.internal_storage_unregister(force).is_some()
    }

    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.token.storage_balance_bounds()
    }

    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.token.storage_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenMetadataProvider for Contract {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        self.metadata.get().unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    #[test]
    fn faucet_registers_and_mints() {
        testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
        let mut c = Contract::new();
        assert_eq!(c.faucet(U128(25_000_000)).0, 25_000_000);
        assert_eq!(c.ft_balance_of(accounts(1)).0, 25_000_000);
        assert_eq!(c.ft_metadata().decimals, 6);
    }

    #[test]
    #[should_panic(expected = "Faucet amount")]
    fn faucet_is_capped() {
        testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(1)).build());
        let mut c = Contract::new();
        c.faucet(U128(FAUCET_MAX + 1));
    }
}
