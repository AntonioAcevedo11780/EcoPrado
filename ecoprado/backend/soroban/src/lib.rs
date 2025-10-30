use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol, Vec, Map};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserInfo {
    pub public_key: String,
    pub name: String,
    pub role: String, // ciudadano, agricultor, negocio
    pub municipio: String,
    pub verification_status: String, // unverified, pending, verified
    pub balance: i128,
    pub co2_saved: i128,
    pub total_actions: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Action {
    pub id: u32,
    pub user_public_key: String,
    pub action_type: String,
    pub description: String,
    pub evidence: String,
    pub reward_amount: i128,
    pub co2_saved: i128,
    pub status: String, // pending, completed, rejected
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VerificationData {
    pub id_type: String, // curp, rfc
    pub id_number: String,
    pub full_name: String,
    pub municipio: String,
    pub user_type: String,
    pub additional_data: Map<String, String>,
}

#[contract]
pub struct EcoPradoContract;

#[contractimpl]
impl EcoPradoContract {
    pub fn initialize(env: &Env, admin: Address) {
        env.storage().instance().set(&Symbol::new(env, "admin"), &admin);
    }

    // Gestión de usuarios
    pub fn register_user(
        env: &Env,
        public_key: String,
        name: String,
        role: String,
        municipio: String,
    ) -> UserInfo {
        let user_info = UserInfo {
            public_key: public_key.clone(),
            name,
            role,
            municipio,
            verification_status: String::from_str(env, "unverified"),
            balance: 0,
            co2_saved: 0,
            total_actions: 0,
        };

        env.storage().persistent().set(&String::from_str(env, "user"), &public_key, &user_info);
        user_info
    }

    pub fn get_user(env: &Env, public_key: String) -> Option<UserInfo> {
        env.storage().persistent().get(&String::from_str(env, "user"), &public_key)
    }

    // Sistema de verificación
    pub fn submit_verification(env: &Env, verification_data: VerificationData) -> bool {
        // Simular verificación gubernamental
        let is_valid = Self::validate_government_data(&verification_data);
        
        if is_valid {
            // Actualizar estado de verificación del usuario
            if let Some(mut user_info) = Self::get_user(env, verification_data.id_number.clone()) {
                user_info.verification_status = String::from_str(env, "verified");
                env.storage().persistent().set(
                    &String::from_str(env, "user"), 
                    &verification_data.id_number, 
                    &user_info
                );
            }
        }
        
        is_valid
    }

    fn validate_government_data(verification_data: &VerificationData) -> bool {
        // Validaciones básicas
        if verification_data.id_number.is_empty() || 
           verification_data.full_name.is_empty() || 
           verification_data.municipio.is_empty() {
            return false;
        }

        // Validar formato CURP
        if verification_data.id_type == "curp" {
            let curp_regex = regex::Regex::new(r"^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{2}$").unwrap();
            return curp_regex.is_match(&verification_data.id_number);
        }

        // Validar formato RFC
        if verification_data.id_type == "rfc" {
            let rfc_regex = regex::Regex::new(r"^[A-Z]{4}[0-9]{6}[A-Z0-9]{3}$").unwrap();
            return rfc_regex.is_match(&verification_data.id_number);
        }

        false
    }

    // Sistema de recompensas
    pub fn report_action(
        env: &Env,
        user_public_key: String,
        action_type: String,
        description: String,
        evidence: String,
    ) -> Action {
        let action_id = Self::get_next_action_id(env);
        
        // Calcular recompensa basada en el tipo de acción
        let reward_amount = Self::calculate_reward(&action_type);
        let co2_saved = Self::calculate_co2_saved(&action_type);

        let action = Action {
            id: action_id,
            user_public_key: user_public_key.clone(),
            action_type,
            description,
            evidence,
            reward_amount,
            co2_saved,
            status: String::from_str(env, "completed"),
            created_at: env.ledger().timestamp(),
        };

        // Guardar acción
        env.storage().persistent().set(
            &String::from_str(env, "action"), 
            &action_id, 
            &action
        );

        // Actualizar usuario
        if let Some(mut user_info) = Self::get_user(env, user_public_key.clone()) {
            user_info.balance += reward_amount;
            user_info.co2_saved += co2_saved;
            user_info.total_actions += 1;
            
            env.storage().persistent().set(
                &String::from_str(env, "user"), 
                &user_public_key, 
                &user_info
            );
        }

        action
    }

    fn calculate_reward(action_type: &str) -> i128 {
        match action_type {
            "reciclaje" => 10,
            "transporte_verde" => 15,
            "ahorro_agua" => 8,
            "agricultura_sostenible" => 25,
            "educacion_ambiental" => 20,
            _ => 5,
        }
    }

    fn calculate_co2_saved(action_type: &str) -> i128 {
        match action_type {
            "reciclaje" => 2,
            "transporte_verde" => 5,
            "ahorro_agua" => 1,
            "agricultura_sostenible" => 8,
            "educacion_ambiental" => 3,
            _ => 1,
        }
    }

    fn get_next_action_id(env: &Env) -> u32 {
        let current_id: u32 = env.storage().instance().get(&Symbol::new(env, "action_id")).unwrap_or(0);
        let next_id = current_id + 1;
        env.storage().instance().set(&Symbol::new(env, "action_id"), &next_id);
        next_id
    }

    // Obtener acciones de un usuario
    pub fn get_user_actions(env: &Env, user_public_key: String) -> Vec<Action> {
        let mut actions = Vec::new(env);
        let mut current_id: u32 = 1;
        
        // Buscar todas las acciones del usuario
        loop {
            if let Some(action) = env.storage().persistent().get(&String::from_str(env, "action"), &current_id) {
                if action.user_public_key == user_public_key {
                    actions.push_back(action);
                }
                current_id += 1;
            } else {
                break;
            }
        }
        
        actions
    }

    // Obtener ranking de usuarios
    pub fn get_ranking(env: &Env, municipio: String) -> Vec<UserInfo> {
        let mut users = Vec::new(env);
        
        // En un contrato real, esto sería más eficiente con índices
        // Por ahora, simulamos obteniendo usuarios conocidos
        let known_users = vec![
            "user1", "user2", "user3", "user4", "user5"
        ];
        
        for user_key in known_users {
            if let Some(user_info) = Self::get_user(env, String::from_str(env, user_key)) {
                if user_info.municipio == municipio {
                    users.push_back(user_info);
                }
            }
        }
        
        // Ordenar por CO2 ahorrado (descendente)
        users
    }
}
