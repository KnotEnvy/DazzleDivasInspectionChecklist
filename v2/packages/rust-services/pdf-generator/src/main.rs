use axum::{
    Router,
    routing::post,
    extract::Json,
    http::StatusCode,
    response::IntoResponse,
};
use serde::Deserialize;
use tower_http::cors::CorsLayer;
use tracing_subscriber;

#[derive(Debug, Deserialize)]
struct TaskResultData {
    description: String,
    completed: bool,
}

#[derive(Debug, Deserialize)]
struct RoomInspectionData {
    room_name: String,
    status: String,
    notes: Option<String>,
    tasks: Vec<TaskResultData>,
    photo_count: u32,
}

#[derive(Debug, Deserialize)]
struct InspectionReport {
    property_name: String,
    property_address: String,
    inspector_name: String,
    inspection_date: String,
    status: String,
    notes: Option<String>,
    rooms: Vec<RoomInspectionData>,
}

async fn generate(Json(report): Json<InspectionReport>) -> impl IntoResponse {
    // TODO: Full PDF generation with genpdf in Phase 5
    // For now, return a placeholder response
    let summary = format!(
        "Inspection Report: {} at {}\nInspector: {}\nDate: {}\nStatus: {}\nRooms: {}",
        report.property_name,
        report.property_address,
        report.inspector_name,
        report.inspection_date,
        report.status,
        report.rooms.len()
    );

    (
        StatusCode::OK,
        [("content-type", "text/plain")],
        summary,
    )
        .into_response()
}

async fn health() -> &'static str {
    "OK"
}

#[tokio::main]
async fn main() {
    tracing_subscriber::init();

    let app = Router::new()
        .route("/generate", post(generate))
        .route("/health", axum::routing::get(health))
        .layer(CorsLayer::permissive());

    let port = std::env::var("PORT").unwrap_or_else(|_| "3002".to_string());
    let addr = format!("0.0.0.0:{port}");
    tracing::info!("PDF generator listening on {addr}");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
