use std::fs;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process;

fn check_file(path: &Path) -> Vec<(usize, String)> {
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return vec![],
    };
    let reader = BufReader::new(file);
    let mut errors = vec![];

    for (i, line) in reader.lines().enumerate() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };
        // Match: from "./SomePascalCase" or from "./dir/SomePascalCase"
        if let Some(start) = line.find("from \"") {
            let rest = &line[start + 6..];
            if let Some(end) = rest.find('"') {
                let import_path = &rest[..end];
                if (import_path.starts_with("./") || import_path.starts_with("../"))
                    && import_path.contains(|c: char| c.is_uppercase())
                {
                    errors.push((i + 1, import_path.to_string()));
                }
            }
        }
        if let Some(start) = line.find("from '") {
            let rest = &line[start + 6..];
            if let Some(end) = rest.find('\'') {
                let import_path = &rest[..end];
                if (import_path.starts_with("./") || import_path.starts_with("../"))
                    && import_path.contains(|c: char| c.is_uppercase())
                {
                    errors.push((i + 1, import_path.to_string()));
                }
            }
        }
    }
    errors
}

fn main() {
    let root = Path::new("app");
    if !root.is_dir() {
        eprintln!("Error: 'app' directory not found");
        process::exit(1);
    }

    let extensions = ["vue", "ts", "js"];
    let mut all_errors: Vec<(String, usize, String)> = vec![];

    fn visit_dir(
        dir: &Path,
        extensions: &[&str],
        all_errors: &mut Vec<(String, usize, String)>,
    ) {
        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };
        for entry in entries {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };
            let path = entry.path();
            if path.is_dir() {
                visit_dir(&path, extensions, all_errors);
            } else if path.is_file() {
                if let Some(ext) = path.extension() {
                    if extensions.contains(&ext.to_str().unwrap_or("")) {
                        let errors = check_file(&path);
                        for (line, import_path) in errors {
                            all_errors.push((path.display().to_string(), line, import_path));
                        }
                    }
                }
            }
        }
    }

    visit_dir(root, &extensions, &mut all_errors);

    all_errors.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1)));

    if all_errors.is_empty() {
        println!("No PascalCase import paths found");
    } else {
        for (file, line, import_path) in &all_errors {
            println!("{file}:{line}  PascalCase import path: {import_path}");
        }
        println!(
            "\nFound {} PascalCase import path(s). Use kebab-case instead.",
            all_errors.len()
        );
        process::exit(1);
    }
}
