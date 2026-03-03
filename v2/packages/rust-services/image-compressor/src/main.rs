use axum::{
    Router,
    routing::post,
    extract::Multipart,
    http::StatusCode,
    response::IntoResponse,
};
use image::ImageFormat;
use std::io::Cursor;
use tower_http::cors::CorsLayer;
use tracing_subscriber;

const MAX_WIDTH: u32 = 1920;
const MAX_HEIGHT: u32 = 1080;
const DEFAULT_QUALITY: u8 = 80;

async fn compress(mut multipart: Multipart) -> impl IntoResponse {
    while let Ok(Some(field)) = multipart.next_field().await {
        if field.name() == Some("image") {
            let data = match field.bytes().await {
                Ok(bytes) => bytes,
                Err(_) => {
                    return (StatusCode::BAD_REQUEST, "Failed to read image data".to_string())
                        .into_response();
                }
            };

            let img = match image::load_from_memory(&data) {
                Ok(img) => img,
                Err(e) => {
                    return (StatusCode::BAD_REQUEST, format!("Invalid image: {e}"))
                        .into_response();
                }
            };

            // Resize if larger than max dimensions
            let resized = img.resize(MAX_WIDTH, MAX_HEIGHT, image::imageops::FilterType::Lanczos3);

            // Encode as JPEG
            let mut output = Cursor::new(Vec::new());
            let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
                &mut output,
                DEFAULT_QUALITY,
            );

            if let Err(e) = resized.write_with_encoder(encoder) {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Compression failed: {e}"),
                )
                    .into_response();
            }

            let compressed = output.into_inner();

            return (
                StatusCode::OK,
                [("content-type", "image/jpeg")],
                compressed,
            )
                .into_response();
        }
    }

    (StatusCode::BAD_REQUEST, "No image field found".to_string()).into_response()
}

async fn health() -> &'static str {
    "OK"
}

#[tokio::main]
async fn main() {
    tracing_subscriber::init();

    let app = Router::new()
        .route("/compress", post(compress))
        .route("/health", axum::routing::get(health))
        .layer(CorsLayer::permissive());

    let port = std::env::var("PORT").unwrap_or_else(|_| "3001".to_string());
    let addr = format!("0.0.0.0:{port}");
    tracing::info!("Image compressor listening on {addr}");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
