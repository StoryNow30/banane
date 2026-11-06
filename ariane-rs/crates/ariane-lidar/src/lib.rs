//! Lecture LiDAR (sous-chantier CH-064-L) : squelette posé par le chef.
//! Ce crate a son ABI propre (arène fixe, tampons Float32 de Potree copiés une fois, hors VBA), exportée par
//! `ariane-coeur` sous le préfixe `lidar_` ; il n'utilise pas l'aiguillage VBA par numéros.

/// Version du format de l'arène, pour que la coquille refuse un cœur désaccordé.
pub const VERSION_ARENE: u32 = 0;

#[cfg(test)]
mod essais {
    #[test]
    fn version_arene() { assert_eq!(super::VERSION_ARENE, 0); }
}
