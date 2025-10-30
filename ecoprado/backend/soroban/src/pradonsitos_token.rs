use soroban_sdk::{contract, contractimpl, Address, Env, String, Symbol, Vec, Map, token};

#[contract]
pub struct PradonsitosToken;

#[contractimpl]
impl PradonsitosToken {
    pub fn initialize(env: &Env, admin: Address, name: String, symbol: String) {
        env.storage().instance().set(&Symbol::new(env, "admin"), &admin);
        env.storage().instance().set(&Symbol::new(env, "name"), &name);
        env.storage().instance().set(&Symbol::new(env, "symbol"), &symbol);
        env.storage().instance().set(&Symbol::new(env, "decimals"), &7u32);
        env.storage().instance().set(&Symbol::new(env, "total_supply"), &1000000i128);
    }

    pub fn name(env: &Env) -> String {
        env.storage().instance().get(&Symbol::new(env, "name")).unwrap()
    }

    pub fn symbol(env: &Env) -> String {
        env.storage().instance().get(&Symbol::new(env, "symbol")).unwrap()
    }

    pub fn decimals(env: &Env) -> u32 {
        env.storage().instance().get(&Symbol::new(env, "decimals")).unwrap()
    }

    pub fn total_supply(env: &Env) -> i128 {
        env.storage().instance().get(&Symbol::new(env, "total_supply")).unwrap()
    }

    pub fn balance_of(env: &Env, address: Address) -> i128 {
        env.storage().persistent().get(&Symbol::new(env, "balance"), &address).unwrap_or(0)
    }

    pub fn transfer(env: &Env, from: Address, to: Address, amount: i128) -> bool {
        from.require_auth();
        
        let from_balance = Self::balance_of(env, from.clone());
        if from_balance < amount {
            return false;
        }

        let to_balance = Self::balance_of(env, to.clone());
        
        env.storage().persistent().set(&Symbol::new(env, "balance"), &from, &(from_balance - amount));
        env.storage().persistent().set(&Symbol::new(env, "balance"), &to, &(to_balance + amount));
        
        true
    }

    pub fn mint(env: &Env, to: Address, amount: i128) -> bool {
        let admin: Address = env.storage().instance().get(&Symbol::new(env, "admin")).unwrap();
        admin.require_auth();

        let current_balance = Self::balance_of(env, to.clone());
        let new_balance = current_balance + amount;
        
        env.storage().persistent().set(&Symbol::new(env, "balance"), &to, &new_balance);
        
        // Actualizar total supply
        let current_supply = Self::total_supply(env);
        env.storage().instance().set(&Symbol::new(env, "total_supply"), &(current_supply + amount));
        
        true
    }

    pub fn burn(env: &Env, from: Address, amount: i128) -> bool {
        from.require_auth();
        
        let current_balance = Self::balance_of(env, from.clone());
        if current_balance < amount {
            return false;
        }

        let new_balance = current_balance - amount;
        env.storage().persistent().set(&Symbol::new(env, "balance"), &from, &new_balance);
        
        // Actualizar total supply
        let current_supply = Self::total_supply(env);
        env.storage().instance().set(&Symbol::new(env, "total_supply"), &(current_supply - amount));
        
        true
    }

    // Función específica para recompensar acciones ecológicas
    pub fn reward_eco_action(env: &Env, user: Address, action_type: String) -> i128 {
        let admin: Address = env.storage().instance().get(&Symbol::new(env, "admin")).unwrap();
        admin.require_auth();

        let reward_amount = Self::calculate_eco_reward(&action_type);
        
        if Self::mint(env, user.clone(), reward_amount) {
            reward_amount
        } else {
            0
        }
    }

    fn calculate_eco_reward(action_type: &str) -> i128 {
        match action_type {
            "reciclaje" => 10,
            "transporte_verde" => 15,
            "ahorro_agua" => 8,
            "agricultura_sostenible" => 25,
            "educacion_ambiental" => 20,
            "reforestacion" => 30,
            "limpieza_publica" => 12,
            "compostaje" => 18,
            _ => 5,
        }
    }

    // Función para canjear tokens por descuentos
    pub fn redeem_tokens(env: &Env, user: Address, amount: i128, business_address: Address) -> bool {
        user.require_auth();
        
        let user_balance = Self::balance_of(env, user.clone());
        if user_balance < amount {
            return false;
        }

        // Quemar tokens del usuario
        if !Self::burn(env, user.clone(), amount) {
            return false;
        }

        // Registrar el canje
        let redemption_id = Self::get_next_redemption_id(env);
        let redemption = Redemption {
            id: redemption_id,
            user: user.clone(),
            business: business_address,
            amount,
            timestamp: env.ledger().timestamp(),
        };

        env.storage().persistent().set(
            &Symbol::new(env, "redemption"), 
            &redemption_id, 
            &redemption
        );

        true
    }

    fn get_next_redemption_id(env: &Env) -> u32 {
        let current_id: u32 = env.storage().instance().get(&Symbol::new(env, "redemption_id")).unwrap_or(0);
        let next_id = current_id + 1;
        env.storage().instance().set(&Symbol::new(env, "redemption_id"), &next_id);
        next_id
    }
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Redemption {
    pub id: u32,
    pub user: Address,
    pub business: Address,
    pub amount: i128,
    pub timestamp: u64,
}
