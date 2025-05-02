module.exports = {
    Pikachu: {
        type: "Electric",
        baseStats: { hp: 60, attack: 85, defense: 50, speed: 110 },
        spMoves: {
            attack: ["Thunderbolt", "Volt Tackle", "Spark"],
            defense: ["Static Field", "Electric Barrier", "Discharge"]
        }
    },
    Charmander: {
        type: "Fire",
        baseStats: { hp: 65, attack: 90, defense: 55, speed: 95 },
        spMoves: {
            attack: ["Flamethrower", "Fire Spin", "Ember"],
            defense: ["Heat Shield", "Flame Armor", "Smoke Screen"]
        }
    },
    Bulbasaur: {
        type: "Grass",
        baseStats: { hp: 70, attack: 75, defense: 70, speed: 60 },
        spMoves: {
            attack: ["Vine Whip", "Razor Leaf", "Solar Beam"],
            defense: ["Leech Seed", "Grass Shield", "Photosynthesis"]
        }
    },
    Squirtle: {
        type: "Water",
        baseStats: { hp: 75, attack: 65, defense: 85, speed: 50 },
        spMoves: {
            attack: ["Water Gun", "Bubble Beam", "Aqua Tail"],
            defense: ["Shell Armor", "Water Veil", "Soak"]
        }
    },
    Gengar: {
        type: "Ghost",
        baseStats: { hp: 70, attack: 100, defense: 60, speed: 130 },
        spMoves: {
            attack: ["Shadow Ball", "Dark Pulse", "Hex"],
            defense: ["Cursed Body", "Night Cloak", "Spooky Mist"]
        }
    },
    Eevee: {
        type: "Normal",
        baseStats: { hp: 65, attack: 70, defense: 60, speed: 75 },
        spMoves: {
            attack: ["Quick Attack", "Swift", "Tackle"],
            defense: ["Focus Energy", "Helping Hand", "Adaptability"]
        }
    }
};
