use axum::{Router, routing::get, serve::ListenerExt};
use mawster_static_files::config::Config;
use tokio::net::{TcpListener, TcpStream};
use tower_http::services::ServeDir;
use tracing::{info, level_filters::LevelFilter};
use tracing_subscriber::EnvFilter;

fn setup_logger() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::builder()
                .with_default_directive(LevelFilter::INFO.into())
                .from_env_lossy(),
        )
        .init();
}

fn disable_nagle(tcp_stream: &mut TcpStream) {
    if let Err(error) = tcp_stream.set_nodelay(true) {
        tracing::warn!(
            "failed to set TCP_NODELAY on incoming connection: {}",
            error
        );
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = Config::from_env()?;
    setup_logger();

    let service_serve = ServeDir::new(config.static_dir);

    let app = Router::new()
        .route("/health", get(|| async { info!("health check") }))
        .nest_service("/static", service_serve);

    let listener = TcpListener::bind(config.bind_url)
        .await?
        .tap_io(disable_nagle);

    info!("The server is starting on {}", config.bind_url);
    axum::serve(listener, app).await?;
    Ok(())
}
