use anyhow::Context;
use image::{ImageReader, imageops::FilterType};
use indicatif::{ParallelProgressIterator, ProgressStyle};
use mawster_static_files::config::Config;
use rayon::prelude::*;
use std::{
    fs::{self},
    io::{self},
    path::{Path, PathBuf},
};
const TEMPLATE_PROGRESS_BAR: &str = "[{elapsed_precise}] {bar:40.cyan/blue} {pos:>2}/{len:2} {msg}";

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
    let style = ProgressStyle::with_template(TEMPLATE_PROGRESS_BAR)?;
    images.par_iter().progress_with_style(style).try_for_each(
        |image_path| -> anyhow::Result<()> {
            let output_path = create_output_path(image_path, output_dir, static_dir)?;
            create_folder_for_asset(&output_path)?;
            convert_image(
                image_path,
                &output_path,
                is_champion_asset(image_path).then_some(sizes),
            )?;
            Ok(())
        },
    )?;
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
    convert_all_image_to_webp(
        &list_png_assets(&config.static_dir)?,
        &config.static_dir,
        &config.output_dir,
        &config.sizes,
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

    use std::fs::File;

    use rstest::rstest;

    use super::*;

    const WHITE_PNG: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/test_assets/logo/white.png");

    #[rstest]
    #[case::single_file("file.png", true)]
    #[case::single_file_upper_case("FILE.PNG", false)]
    #[case::full_path("full/path/file.png", true)]
    #[case::missing_extension("file", false)]
    #[case::wrong_extension("file.exe", false)]
    fn is_png_matches_only_png_extension(#[case] path: &str, #[case] valid: bool) {
        assert_eq!(is_png(Path::new(path)), valid);
    }

    #[rstest]
    #[case::full_path("full/path/champions/file.png", true)]
    #[case::champion_in_file_name("folder/champions.png", false)]
    #[case::not_a_champion("full/path/file.png", false)]
    fn is_champion_asset_detects_champions_segment(#[case] path: &str, #[case] valid: bool) {
        assert_eq!(is_champion_asset(Path::new(path)), valid);
    }

    #[test]
    fn create_folder_for_asset_creates_missing_parents() {
        // Arrange
        let tmp = tempfile::tempdir().unwrap();
        let output = tmp.path().join("temp/file.webp");
        // Act
        create_folder_for_asset(&output).unwrap();
        // Assert
        assert!(output.parent().unwrap().is_dir());
        assert!(!output.exists());
    }

    #[rstest]
    #[case::empty("")]
    #[case::root("/")]
    fn create_folder_for_asset_rejects_path_without_parent(#[case] path: &str) {
        assert!(create_folder_for_asset(Path::new(path)).is_err());
    }

    #[test]
    fn list_png_assets_recurses_and_skips_non_png() {
        // Arrange
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir(tmp.path().join("sub")).unwrap();
        let files_to_create = ["foo.png", "foo.PNG", "foo.txt", "foo.webp", "sub/bar.png"];
        let expected_results = [tmp.path().join("foo.png"), tmp.path().join("sub/bar.png")];
        files_to_create
            .iter()
            .try_for_each(|file| File::create(tmp.path().join(file)).map(drop))
            .unwrap();
        // Act
        let mut results = list_png_assets(tmp.path()).unwrap();
        // Assert
        results.sort();
        assert_eq!(results, expected_results);
    }

    #[test]
    fn convert_image_without_sizes_writes_single_webp() {
        // Arrange
        let tmp = tempfile::tempdir().unwrap();
        let input = Path::new(WHITE_PNG);
        let output = tmp.path().join("white.webp");
        // Act
        convert_image(input, &output, None).unwrap();
        // Assert
        assert_eq!(fs::read_dir(tmp.path()).unwrap().count(), 1);
        assert!(output.is_file());
        assert_eq!(
            image::image_dimensions(&output).unwrap(),
            image::image_dimensions(input).unwrap(),
        );
    }

    #[rstest]
    #[case::multiple_dimensions(&[1, 5])]
    #[case::no_dimension(&[])]
    fn convert_image_with_sizes_writes_one_webp_per_size(#[case] sizes: &[u32]) {
        // Arrange
        let tmp = tempfile::tempdir().unwrap();
        let input = Path::new(WHITE_PNG);
        let output = tmp.path().join("white.webp");
        // Act
        convert_image(input, &output, Some(sizes)).unwrap();
        // Assert
        assert_eq!(fs::read_dir(tmp.path()).unwrap().count(), sizes.len());
        for size in sizes {
            let new_output = tmp.path().join(format!("white_{size}x{size}.webp"));
            assert!(new_output.is_file());
            assert_eq!(
                image::image_dimensions(&new_output).unwrap(),
                (*size, *size)
            );
        }
    }

    #[test]
    fn create_output_path_mirrors_tree_with_webp_extension() {
        let output = create_output_path(
            Path::new("/static/champions/hulk.png"),
            Path::new("/build"),
            Path::new("/static"),
        )
        .unwrap();
        assert_eq!(output, Path::new("/build/champions/hulk.webp"));
    }

    #[test]
    fn create_output_path_rejects_image_outside_static_dir() {
        let output = create_output_path(
            Path::new("/elsewhere/hulk.png"),
            Path::new("/build"),
            Path::new("/static"),
        );
        assert!(output.is_err());
    }
    #[test]
    fn convert_all_images_full_mirror() {
        // Arrange
        let tmp = tempfile::tempdir().unwrap();
        let fake_static_dir = Path::new(concat!(env!("CARGO_MANIFEST_DIR"), "/test_assets"));
        let sizes = &[1, 2, 3];
        // Act
        convert_all_image_to_webp(
            &list_png_assets(fake_static_dir).unwrap(),
            fake_static_dir,
            tmp.path(),
            sizes,
        )
        .unwrap();
        // Assert
        assert_eq!(fs::read_dir(tmp.path()).unwrap().count(), 2); // 2 folders

        let logo_path = &tmp.path().join("logo");
        assert_eq!(fs::read_dir(logo_path).unwrap().count(), 1);
        assert!(logo_path.join("white.webp").is_file());

        let champions_path = &tmp.path().join("champions");
        assert_eq!(fs::read_dir(champions_path).unwrap().count(), sizes.len());
        for size in sizes {
            let selected_output = champions_path.join(format!("white_{size}x{size}.webp"));
            assert!(selected_output.is_file());
            assert_eq!(
                image::image_dimensions(&selected_output).unwrap(),
                (*size, *size)
            );
        }
    }
}
