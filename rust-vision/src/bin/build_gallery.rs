//! Embeds every champion portrait into `GalleryConfig::output`, the one file the
//! runtime needs to name champions. Rerun after any change to the mosaic.
use anyhow::{Result, ensure};
use clap::Parser;
use mcoc_vision::{config::GalleryConfig, gallery};
use std::fs;

fn main() -> Result<()> {
    let config = GalleryConfig::parse();
    let built = gallery::build(&config)?;
    let path = config.output.as_path();
    gallery::save(path, &built)?;
    let loaded = gallery::load(path)?;
    ensure!(
        loaded.len() == built.len()
            && loaded
                .iter()
                .zip(&built)
                .all(|((read_name, read), (name, _, embedding))| {
                    read_name == name && read == embedding
                }),
        "{} does not read back what was written",
        path.display()
    );
    println!(
        "{} champions -> {} ({} KB)",
        built.len(),
        path.display(),
        fs::metadata(path)?.len() / 1024
    );
    Ok(())
}
