# stat-i18n.json の ui/stats/unique 各エントリに pt/es/fr/de を追加する。
import json

UI = {
 "stats": ("Atributos","Atributos","Stats","Werte"),
 "steamDesc": ("Descrição da Steam","Descripción de Steam","Description Steam","Steam-Beschreibung"),
 "requiredLv": ("Nível necessário","Nivel requerido","Niveau requis","Erforderliche Stufe"),
 "baseStats": ("Atributos base","Atributos base","Stats de base","Basiswerte"),
 "inherentStats": ("Atributos inerentes","Atributos inherentes","Stats inhérents","Inhärente Werte"),
 "specialStats": ("Atributos especiais","Atributos especiales","Stats spéciaux","Spezialwerte"),
 "grantedEffects": ("Efeitos concedidos","Efectos concedidos","Effets accordés","Gewährte Effekte"),
 "decoration": ("Decoração","Decoración","Décoration","Dekoration"),
 "engraving": ("Gravação","Grabado","Gravure","Gravur"),
 "inscription": ("Inscrição","Inscripción","Inscription","Inschrift"),
 "weapon": ("Arma","Arma","Arme","Waffe"),
 "armor": ("Armadura","Armadura","Armure","Rüstung"),
 "accessory": ("Acessório","Accesorio","Accessoire","Accessoire"),
 "materialType": ("Tipo de material","Tipo de material","Type de matériau","Materialtyp"),
 "special": ("Especial","Especial","Spécial","Spezial"),
 "hasSpecial": ("Com atributo especial","Con atributo especial","Avec stat spécial","Mit Spezialwert"),
 "DECORATION": ("Material de decoração","Material de decoración","Matériau de décoration","Dekorationsmaterial"),
 "ENGRAVING": ("Material de gravação","Material de grabado","Matériau de gravure","Gravurmaterial"),
 "INSCRIPTION": ("Material de inscrição","Material de inscripción","Matériau d'inscription","Inschriftmaterial"),
 "CRAFTING": ("Material de fabricação","Material de fabricación","Matériau d'artisanat","Handwerksmaterial"),
 "SOULSTONE": ("Pedra da alma","Piedra del alma","Pierre d'âme","Seelenstein"),
 "groupOffense": ("Ataque","Ataque","Attaque","Angriff"),
 "groupDefense": ("Defesa","Defensa","Défense","Verteidigung"),
 "groupResist": ("Resistência","Resistencia","Résistance","Resistenz"),
 "groupSustain": ("Utilidade","Utilidad","Utilité","Hilfreich"),
 "grantAll": ("Concede todos os listados (por tipo de equipamento)","Concede todos los indicados (por tipo de equipo)","Accorde tous ceux listés (par type d'équipement)","Gewährt alle aufgeführten (je Ausrüstungstyp)"),
 "grantRandom": ("Concede aleatoriamente um dos abaixo","Concede aleatoriamente uno de los siguientes","Accorde aléatoirement l'un des suivants","Gewährt zufällig einen der folgenden"),
 "cheapest": ("Mais barato com este atributo","Más barato con este atributo","Le moins cher avec ce stat","Günstigster mit diesem Wert"),
 "viewItemsWith": ("Ver itens com este atributo","Ver objetos con este atributo","Voir les objets avec ce stat","Objekte mit diesem Wert ansehen"),
 "compare": ("Comparar","Comparar","Comparer","Vergleichen"),
 "statFilterPlaceholder": ("Filtrar atributos…","Filtrar atributos…","Filtrer les stats…","Werte filtern…"),
}

S = {
 "attack_damage": ("Dano de ataque","Daño de ataque","Dégâts d'attaque","Angriffsschaden"),
 "add_hp_per_kill": ("HP por abate","Vida por muerte","PV par élimination","LP pro Kill"),
 "all_elemental_resistance": ("Resistência a todos os elementos","Resistencia a todos los elementos","Résistance à tous les éléments","Resistenz gegen alle Elemente"),
 "armor": ("Armadura","Armadura","Armure","Rüstung"),
 "attack_speed": ("Velocidade de ataque","Velocidad de ataque","Vitesse d'attaque","Angriffstempo"),
 "basic_attack_requirement_reduction": ("Redução do requisito de ataque básico","Reducción del requisito de ataque básico","Réduction du prérequis d'attaque de base","Reduzierung der Grundangriff-Anforderung"),
 "block_chance": ("Chance de bloqueio","Probabilidad de bloqueo","Chance de blocage","Blockchance"),
 "chaos_resistance": ("Resistência ao caos","Resistencia al caos","Résistance au chaos","Chaosresistenz"),
 "cold_damage": ("Dano de gelo","Daño de frío","Dégâts de froid","Kälteschaden"),
 "cold_resistance": ("Resistência ao gelo","Resistencia al frío","Résistance au froid","Kälteresistenz"),
 "cooldown_reduction": ("Redução de recarga","Reducción de enfriamiento","Réduction de recharge","Abklingzeit-Reduzierung"),
 "critical_chance": ("Chance crítica","Probabilidad crítica","Chance critique","Kritische Chance"),
 "critical_damage": ("Dano crítico","Daño crítico","Dégâts critiques","Kritischer Schaden"),
 "damage_absorption": ("Absorção de dano","Absorción de daño","Absorption de dégâts","Schadensabsorption"),
 "damage_reduction": ("Redução de dano","Reducción de daño","Réduction de dégâts","Schadensreduzierung"),
 "dodge_chance": ("Chance de esquiva","Probabilidad de esquiva","Chance d'esquive","Ausweichchance"),
 "fire_damage": ("Dano de fogo","Daño de fuego","Dégâts de feu","Feuerschaden"),
 "fire_resistance": ("Resistência ao fogo","Resistencia al fuego","Résistance au feu","Feuerresistenz"),
 "hp_per_hit": ("HP por acerto","Vida por golpe","PV par coup","LP pro Treffer"),
 "hp_regen_per_sec": ("Regeneração de HP por seg","Regeneración de vida por seg","Régén. PV par sec","LP-Regen pro Sek"),
 "increased_area_of_effect": ("Aumento de área de efeito","Aumento de área de efecto","Zone d'effet augmentée","Erhöhter Wirkungsbereich"),
 "increased_area_of_effect_damage": ("Aumento de dano em área","Aumento de daño en área","Dégâts de zone augmentés","Erhöhter Flächenschaden"),
 "increased_armor": ("Aumento de armadura","Aumento de armadura","Armure augmentée","Erhöhte Rüstung"),
 "increased_attack_damage": ("Aumento de dano de ataque","Aumento de daño de ataque","Dégâts d'attaque augmentés","Erhöhter Angriffsschaden"),
 "increased_attack_speed": ("Aumento de velocidade de ataque","Aumento de velocidad de ataque","Vitesse d'attaque augmentée","Erhöhtes Angriffstempo"),
 "increased_cast_speed": ("Aumento de velocidade de conjuração","Aumento de velocidad de lanzamiento","Vitesse d'incantation augmentée","Erhöhtes Zaubertempo"),
 "increased_critical_chance_multiplier": ("Aumento do multiplicador de chance crítica","Aumento del multiplicador de prob. crítica","Multiplicateur de chance critique augmenté","Erhöhter Krit-Chance-Multiplikator"),
 "increased_exp_gain": ("Aumento de ganho de EXP","Aumento de ganancia de EXP","Gain d'EXP augmenté","Erhöhter EP-Gewinn"),
 "increased_max_hp": ("Aumento de HP máximo","Aumento de vida máxima","PV max augmentés","Erhöhte max. LP"),
 "increased_melee_damage": ("Aumento de dano corpo a corpo","Aumento de daño cuerpo a cuerpo","Dégâts de mêlée augmentés","Erhöhter Nahkampfschaden"),
 "increased_movement_speed": ("Aumento de velocidade de movimento","Aumento de velocidad de movimiento","Vitesse de déplacement augmentée","Erhöhtes Lauftempo"),
 "increased_projectile_damage": ("Aumento de dano de projétil","Aumento de daño de proyectil","Dégâts de projectile augmentés","Erhöhter Projektilschaden"),
 "increased_skill_duration": ("Aumento de duração de habilidade","Aumento de duración de habilidad","Durée de compétence augmentée","Erhöhte Fähigkeitsdauer"),
 "increased_skill_heal": ("Aumento de cura de habilidade","Aumento de curación de habilidad","Soin de compétence augmenté","Erhöhte Fähigkeitsheilung"),
 "increased_skill_range": ("Aumento de alcance de habilidade","Aumento de alcance de habilidad","Portée de compétence augmentée","Erhöhte Fähigkeitsreichweite"),
 "increased_summon_damage": ("Aumento de dano de invocação","Aumento de daño de invocación","Dégâts d'invocation augmentés","Erhöhter Beschwörungsschaden"),
 "life_leech": ("Roubo de vida","Robo de vida","Vol de vie","Lebensentzug"),
 "lightning_damage": ("Dano de raio","Daño de rayo","Dégâts de foudre","Blitzschaden"),
 "lightning_resistance": ("Resistência a raio","Resistencia a rayo","Résistance à la foudre","Blitzresistenz"),
 "max_hp": ("HP máximo","Vida máxima","PV max","Max. LP"),
 "more_attack_speed": ("Mais velocidade de ataque","Más velocidad de ataque","Plus de vitesse d'attaque","Mehr Angriffstempo"),
 "movement_speed": ("Velocidade de movimento","Velocidad de movimiento","Vitesse de déplacement","Lauftempo"),
 "physical_damage": ("Dano físico","Daño físico","Dégâts physiques","Physischer Schaden"),
 "skill_heal": ("Cura de habilidade","Curación de habilidad","Soin de compétence","Fähigkeitsheilung"),
}

U = {
 "crossbow_turret_cooldown_is_reduced_by_50": ("A recarga da Torre de Besta é reduzida em 50%.","La recarga de la Torreta de Ballesta se reduce un 50%.","Le temps de recharge de la Tourelle d'arbalète est réduit de 50 %.","Die Abklingzeit des Armbrust-Geschützturms wird um 50 % reduziert."),
 "equipped_skill_s_cooldown_is_reduced": ("A recarga da habilidade equipada é reduzida.","La recarga de la habilidad equipada se reduce.","Le temps de recharge de la compétence équipée est réduit.","Die Abklingzeit der ausgerüsteten Fähigkeit wird reduziert."),
 "hydra_s_attack_speed_increases_by_200": ("A velocidade de ataque da Hidra aumenta em 200%.","La velocidad de ataque de la Hidra aumenta un 200%.","La vitesse d'attaque de l'Hydre augmente de 200 %.","Das Angriffstempo der Hydra erhöht sich um 200 %."),
 "skewer_shot_deals_double_damage_to_bleeding_enemies": ("Tiro Perfurante causa o dobro de dano a inimigos sangrando.","Disparo Empalador inflige el doble de daño a enemigos sangrando.","Tir empaleur inflige le double de dégâts aux ennemis qui saignent.","Spießschuss verursacht doppelten Schaden an blutenden Gegnern."),
 "snowstorm_deals_100_additional_damage_to_frozen_enemies": ("Nevasca causa 100% de dano adicional a inimigos congelados.","Ventisca inflige un 100% de daño adicional a enemigos congelados.","Tempête de neige inflige 100 % de dégâts supplémentaires aux ennemis gelés.","Schneesturm verursacht 100 % zusätzlichen Schaden an gefrorenen Gegnern."),
 "while_under_wrath_of_heaven_buff_attacking_enemies_also_casts_heal_on_allies": ("Sob o efeito de Ira dos Céus, atacar inimigos também lança Cura nos aliados.","Bajo el efecto de Ira de los Cielos, atacar a enemigos también lanza Curación en aliados.","Sous l'effet de Colère des Cieux, attaquer des ennemis lance aussi Soin sur les alliés.","Unter dem Buff Zorn des Himmels wirkt das Angreifen von Gegnern auch Heilung auf Verbündete."),
}

si = json.load(open('assets/stat-i18n.json', encoding='utf-8'))
LANGS = ['pt', 'es', 'fr', 'de']
def add(section, table):
    miss = []
    for k, v in section.items():
        if k not in table:
            miss.append(k); continue
        for i, lang in enumerate(LANGS):
            v[lang] = table[k][i]
    return miss

m1 = add(si['ui'], UI)
m2 = add(si['stats'], S)
m3 = add(si['unique'], U)
json.dump(si, open('assets/stat-i18n.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ui missing:', m1, '| stats missing:', m2, '| unique missing:', m3)
print('done. ui', len(si['ui']), 'stats', len(si['stats']), 'unique', len(si['unique']))
