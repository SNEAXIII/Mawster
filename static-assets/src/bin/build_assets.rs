use anyhow::Context;
use image::{ImageReader, imageops::FilterType};
use mawster_static_files::config::Config;
use rayon::prelude::*;
use std::{
    fs::{self},
    io::{self},
    path::{Path, PathBuf},
    sync::atomic::{AtomicUsize, Ordering},
};
fn is_png(path: &Path) -> bool {
    path.extension().is_some_and(|ext| ext == "png")
}

fn is_champion_asset(path: &Path) -> bool {
    path.iter().any(|part| part == "champions")
}

fn create_folder_for_asset(output_path: &Path) -> anyhow::Result<()> {
    fs::create_dir_all(output_path.parent().context("Should have a parent")?)?;
    Ok(())
}

fn list_png_assets(dir: &Path) -> io::Result<Vec<PathBuf>> {
    let mut images: Vec<PathBuf> = Vec::new();
    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
        if path.is_dir() {
            images.extend(list_png_assets(&path)?);
        } else if is_png(&path) {
            images.push(path);
        }
    }
    Ok(images)
}

fn convert_image(
    image_path: &Path,
    output_path: &Path,
    sizes: Option<&[u32]>,
) -> anyhow::Result<()> {
    let image = ImageReader::open(image_path)?
        .with_guessed_format()?
        .decode()?;

    match sizes {
        Some(sizes) => {
            let stem = output_path.file_stem().context("Should have a stem")?;
            for &size in sizes {
                let mut file_name = stem.to_owned();
                file_name.push(format!("_{size}x{size}.webp"));
                image
                    .resize(size, size, FilterType::Lanczos3)
                    .save(output_path.with_file_name(file_name))?;
            }
        }
        None => image.save(output_path)?,
    }
    Ok(())
}

fn convert_all_image_to_webp(
    images: &[PathBuf],
    static_dir: &Path,
    output_dir: &Path,
    sizes: &[u32],
) -> anyhow::Result<()> {
    let done = AtomicUsize::new(0);
    images
        .par_iter()
        .try_for_each(|image_path| -> anyhow::Result<()> {
            let output_path = create_output_path(image_path, output_dir, static_dir)?;
            create_folder_for_asset(&output_path)?;
            convert_image(
                image_path,
                &output_path,
                is_champion_asset(image_path).then_some(sizes),
            )?;
            let count = done.fetch_add(1, Ordering::Relaxed) + 1;
            eprint!("\r{count}/{} files converted", images.len());
            Ok(())
        })?;
    println!("\nSuccessfully converted {} PNG to WebP!", images.len());
    Ok(())
}

fn create_output_path(
    image_path: &Path,
    output_dir: &Path,
    static_dir: &Path,
) -> anyhow::Result<PathBuf> {
    Ok(output_dir
        .join(image_path.strip_prefix(static_dir)?)
        .with_extension("webp"))
}

fn main() -> anyhow::Result<()> {
    let config = Config::from_env()?;
    let images = list_png_assets(&config.static_dir)?;
    convert_all_image_to_webp(
        &images,
        &config.static_dir,
        &config.output_dir,
        &config.sizes,
    )?;
    Ok(())
}
