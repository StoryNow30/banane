// CH-064-L : mémoire linéaire BORNÉE du module autonome ariane_lidar.wasm.
// Pile de 64 Kio (au lieu de 1 Mio) ; mémoire initiale = mémoire maximale = 512 Kio : le module ne peut pas grandir.
// Tout le travail se fait dans des tableaux statiques de taille fixe (src/abi.rs) ; aucune allocation n'a lieu.
fn main() {
    if std::env::var("CARGO_CFG_TARGET_ARCH").as_deref() == Ok("wasm32") {
        for a in ["-zstack-size=65536", "--initial-memory=524288", "--max-memory=524288"] {
            println!("cargo:rustc-link-arg-cdylib={a}");
        }
    }
}
