use mcoc_vision::pipeline::Matrix;
use std::path::{Path, PathBuf};

/// Next to `rust_cards.json`: both keyed by the file stem, which survives a shot filter.
pub fn get_and_create_debug_path(filepath: &str) -> anyhow::Result<PathBuf> {
    let dir = Path::new("out/debug").join(stem(filepath));
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join(format!("{}.png", stem(filepath))))
}

/// The portrait boxes `mosaic_bench` names and `scripts/naming_margins.py` audits, keyed by the ground truth's `r{row}c{col}` cells.
pub fn write_rust_cards(path: &str, card_matrix: &Matrix) -> anyhow::Result<()> {
    let cards: Vec<_> = card_matrix
        .cells()
        .map(|(cell, card)| {
            let b = &card.champion_box;
            serde_json::json!({
                "cell": cell,
                "portrait": [b.left, b.top, b.right, b.bottom],
                "ascension": card.ascension,
                "name": card.champion_name,
                "margin": card.name_margin,
            })
        })
        .collect();
    let dir = Path::new("out/debug").join(stem(path));
    std::fs::create_dir_all(&dir)?;
    std::fs::write(dir.join("rust_cards.json"), serde_json::to_string(&cards)?)?;
    Ok(())
}
pub fn stem(path: &str) -> &str {
    Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("shot")
}
