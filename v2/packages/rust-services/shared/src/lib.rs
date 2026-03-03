use serde::{Deserialize, Serialize};

/// Standard API error response.
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiError {
    pub error: String,
    pub code: u16,
}

/// Validate API key from request headers.
pub fn validate_api_key(header_value: Option<&str>, expected: &str) -> Result<(), ApiError> {
    match header_value {
        Some(key) if key == expected => Ok(()),
        _ => Err(ApiError {
            error: "Unauthorized".to_string(),
            code: 401,
        }),
    }
}
