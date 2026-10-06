use anyhow::Context;
use image::{ImageReader, imageops::FilterType};
use mawster_static_files::config::Config;
use regex::Regex;
use std::{
    fs::{self},
    io::{self},
    path::{Path, PathBuf},
};
struct FolderConverter {
    regex: Regex,
    sizes: Vec<u32>,
}
impl FolderConverter {
    const fn new(regex: Regex, sizes: Vec<u32>) -> Self {
        Self { regex, sizes }
    }

    fn list_base_images(&self, dir: &Path) -> io::Result<Vec<PathBuf>> {
        let mut images: Vec<PathBuf> = Vec::new();
        for entry in fs::read_dir(dir)? {
            let path = entry?.path();
            if path.is_dir() {
                images.extend(self.list_base_images(&path)?);
            } else if self.is_valid_png_asset(&path) {
                images.push(path);
            }
        }
        Ok(images)
    }

    fn convert_image(
        image_path: &Path,
        output_path: &Path,
        size: Option<u32>,
    ) -> anyhow::Result<()> {
        let image = ImageReader::open(image_path)?
            .with_guessed_format()?
            .decode()?;
        let image = match size {
            Some(value) => image.resize(value, value, FilterType::Lanczos3),
            None => image,
        };
        image.save(output_path)?;
        Ok(())
    }

    fn is_valid_png_asset(&self, path: &Path) -> bool {
        path.extension().is_some_and(|ext| ext == "png")
            && path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|file_name| !self.regex.is_match(file_name))
    }

    fn convert_all_image_to_webp(
        &self,
        images: &[PathBuf],
        static_dir: &Path,
        output_dir: &Path,
    ) -> anyhow::Result<()> {
        for image_path in images {
            let output_path = output_dir
                .join(image_path.strip_prefix(static_dir)?)
                .with_extension("webp");
            fs::create_dir_all(output_path.parent().context("Should have a parent")?)?;
            if image_path.iter().any(|part| part == "champions") {
                let stem = output_path.file_stem().context("Should have a stem")?;
                for &size in &self.sizes {
                    let mut name = stem.to_owned();
                    name.push(format!("_{size}x{size}.webp"));
                    Self::convert_image(image_path, &output_path.with_file_name(name), Some(size))?;
                }
            } else {
                Self::convert_image(image_path, &output_path, None)?;
            }
        }
        Ok(())
    }
}
fn main() -> anyhow::Result<()> {
    eprintln!("cwd: {}", std::env::current_dir()?.display());
    let config = Config::from_env()?;
    eprintln!("target: {}", config.static_dir.display());
    let regex = Regex::new(r"[\w_-]+\d+x\d+")?;
    let converter = FolderConverter::new(regex, config.sizes);
    let images = converter.list_base_images(&config.static_dir)?;
    converter.convert_all_image_to_webp(&images, &config.static_dir, &config.output_dir)?;
    println!("Successfully converted PNG to JPEG!");
    Ok(())
}
