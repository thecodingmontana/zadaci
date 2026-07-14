use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::Path;

fn fix_file(path: &Path) -> bool {
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return false,
    };
    let reader = BufReader::new(file);
    let lines: Vec<String> = reader.lines().filter_map(|l| l.ok()).collect();
    let mut changed = false;

    let mut out_lines = Vec::new();
    for line in &lines {
        let mut modified = line.clone();
        // Pattern 1: [class*='X-']  →  [class*=\'X-\']
        // Pattern 2: [class*=\'X-']  →  [class*=\'X-\']
        // Both result in the same replacement: [class*=\'X-\']
        let replacement = regex_replace(
            &modified,
            r"\[class\*=\\?'?([a-zA-Z]+)-'\]",
            "[class*=\\'$1-\\']",
        );
        if let Some(fixed) = replacement {
            modified = fixed;
            changed = true;
        }
        out_lines.push(modified);
    }

    if changed {
        let mut f = fs::File::create(path).expect("Failed to write file");
        for line in &out_lines {
            writeln!(f, "{line}").expect("Failed to write line");
        }
    }
    changed
}

fn regex_replace(text: &str, pattern: &str, replacement: &str) -> Option<String> {
    let re = regex::Regex::new(pattern).ok()?;
    if re.is_match(text) {
        Some(re.replace_all(text, replacement).to_string())
    } else {
        None
    }
}

fn main() {
    let root = Path::new(".");
    let mut fixed_files: Vec<String> = vec![];

    fn visit_dir(dir: &Path, fixed_files: &mut Vec<String>) {
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
                // Skip node_modules, target, .nuxt, .git, dist
                let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                if name == "node_modules" || name == "target" || name == ".nuxt" || name == ".git" || name == "dist" || name == ".output" || name == ".data" || name == ".nitro" || name == ".cache" {
                    continue;
                }
                visit_dir(&path, fixed_files);
            } else if path.is_file() {
                if path.extension().map(|e| e == "vue").unwrap_or(false) {
                    if fix_file(&path) {
                        fixed_files.push(path.display().to_string());
                    }
                }
            }
        }
    }

    visit_dir(root, &mut fixed_files);
    fixed_files.sort();

    if fixed_files.is_empty() {
        println!("No files needed fixing");
    } else {
        for f in &fixed_files {
            println!("Fixed: {f}");
        }
        println!("\nFixed {} files", fixed_files.len());
    }
}
