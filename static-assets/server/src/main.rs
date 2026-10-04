use axum::{Router, http, routing::get};
use tower_http::services::ServeDir;
use tracing_subscriber::EnvFilter;
const DEFAULT_STATIC_DIR: &str = "../static";
const DEFAULT_LOG_LEVEL: &str = "info";
const BIND_HOST: &str = "0.0.0.0";
const BIND_PORT: u16 = 8002;
#[tokio::main]
async fn main() -> std::io::Result<()> {
    // initialize tracing
    let log_level = EnvFilter::try_from_default_env();

    if let Err(error) = &log_level
        && let Ok(log_level) = std::env::var("RUST_LOG")
    {
        eprintln!(
            "`{log_level}` is invalid RUST_LOG ({error}), falling back to {DEFAULT_LOG_LEVEL}"
        );
    }

    tracing_subscriber::fmt()
        .with_env_filter(log_level.unwrap_or_else(|_| EnvFilter::new(DEFAULT_LOG_LEVEL)))
        .init();

    let app = Router::new().route("/health", get(health)).nest_service(
        "/static",
        ServeDir::new(
            std::env::var("STATIC_DIR").unwrap_or_else(|_| DEFAULT_STATIC_DIR.to_owned()),
        ),
    );

    let listener = tokio::net::TcpListener::bind((BIND_HOST, BIND_PORT)).await?;
    tracing::info!("Le serveur démarre");
    axum::serve(listener, app).await
}

async fn health() -> http::StatusCode {
    http::StatusCode::OK
}
