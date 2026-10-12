import { EMOJI_CATEGORIES, EMOJI_CATEGORY_ORDER } from '#lib/constants.js';
import { normalize, searchEmojis } from './search.js';

/**
 * The words people use most for their expenses, in the app's languages,
 * with the emoji they call for. Checked first: the CLDR names miss most of
 * them ("resto", "loyer", "Airbnb"...) or point elsewhere ("marché").
 * Every emoji here belongs to an expense category (see the tests).
 */
export const COMMON_EXPENSE_WORDS: readonly (readonly [string, readonly string[]])[] = [
    ['🍽️', ['resto', 'restaurant', 'restaurante', 'ristorante', 'brasserie', 'bistro', 'diner', 'dinner', 'dejeuner', 'lunch', 'abendessen', 'mittagessen', 'almuerzo', 'cena', 'jantar', 'almoco']],
    ['🛒', ['courses', 'supermarche', 'supermarket', 'groceries', 'grocery', 'epicerie', 'marche', 'carrefour', 'leclerc', 'lidl', 'aldi', 'auchan', 'intermarche', 'monoprix', 'franprix', 'rewe', 'edeka', 'einkauf', 'supermercado', 'mercado', 'compras']],
    ['🥐', ['boulangerie', 'bakery', 'croissant', 'croissants', 'viennoiseries', 'petit dej', 'petit dejeuner', 'breakfast', 'fruhstuck', 'backerei', 'desayuno', 'panaderia', 'padaria', 'pequeno almoco']],
    ['☕', ['cafe', 'coffee', 'kaffee', 'starbucks']],
    ['🍺', ['biere', 'bieres', 'beer', 'beers', 'bier', 'cerveza', 'cerveja', 'pinte', 'pub']],
    ['🍷', ['vin', 'wine', 'wein', 'vino', 'vinho']],
    ['🍹', ['apero', 'aperitif', 'cocktail', 'cocktails', 'bar', 'drinks', 'verres']],
    ['🍕', ['pizza', 'pizzas', 'pizzeria']],
    ['🍔', ['burger', 'burgers', 'mcdo', 'mcdonald', 'mcdonalds', 'kfc', 'fast food']],
    ['🍣', ['sushi', 'sushis', 'japonais']],
    ['⛽', ['essence', 'carburant', 'gasoil', 'diesel', 'fuel', 'petrol', 'plein', 'tanken', 'benzin', 'gasolina', 'combustivel']],
    ['🚗', ['peage', 'peages', 'toll', 'autoroute', 'maut', 'peaje', 'portagem', 'location voiture', 'car rental', 'mietwagen']],
    ['🅿️', ['parking', 'stationnement', 'parken', 'parkhaus', 'aparcamiento', 'estacionamento']],
    ['🚆', ['train', 'trains', 'sncf', 'tgv', 'ouigo', 'bahn', 'zug', 'tren', 'comboio', 'renfe']],
    ['✈️', ['avion', 'vol', 'vols', 'flight', 'flights', 'plane', 'flug', 'vuelo', 'voo', 'easyjet', 'ryanair']],
    ['🚕', ['taxi', 'uber', 'vtc', 'bolt', 'cabify']],
    ['🚇', ['metro', 'navigo', 'ubahn', 'subway']],
    ['🚌', ['bus', 'flixbus', 'navette', 'shuttle']],
    ['⛴️', ['ferry', 'bateau', 'boat', 'fahre', 'barco']],
    ['🏨', ['hotel', 'hotels', 'hostel', 'auberge', 'hostal']],
    ['🏠', ['airbnb', 'loyer', 'rent', 'location', 'gite', 'logement', 'appartement', 'apartment', 'miete', 'wohnung', 'alquiler', 'aluguel']],
    ['🎬', ['cinema', 'cine', 'film', 'movie', 'kino']],
    ['🎟️', ['billet', 'billets', 'ticket', 'tickets', 'entree', 'entrees', 'concert', 'musee', 'museum', 'museo', 'spectacle', 'theatre', 'festival', 'eintritt']],
    ['⛷️', ['ski', 'skis', 'forfait ski', 'skipass', 'remontees']],
    ['🏖️', ['plage', 'beach', 'strand', 'playa', 'praia']],
    ['💊', ['pharmacie', 'pharmacy', 'medicaments', 'apotheke', 'farmacia']],
    ['🏥', ['medecin', 'doctor', 'docteur', 'arzt', 'medico', 'hopital', 'hospital']],
    ['🎁', ['cadeau', 'cadeaux', 'gift', 'gifts', 'present', 'geschenk', 'regalo', 'presente']],
    ['🎂', ['anniversaire', 'anniv', 'birthday', 'geburtstag', 'cumpleanos', 'aniversario', 'gateau', 'cake']],
    ['💡', ['electricite', 'edf', 'electricity', 'strom', 'luz', 'energie']],
    ['📶', ['internet', 'wifi', 'box', 'fibre']],
    ['📱', ['telephone', 'forfait', 'phone', 'handy', 'movil', 'telemovel']],
    ['🧹', ['menage', 'cleaning', 'putzen', 'limpieza', 'limpeza']],
    ['🧼', ['laverie', 'laundry', 'lessive', 'pressing']],
];

/** The emojis of the expense categories, the only ones worth suggesting. */
const EXPENSE_EMOJIS = EMOJI_CATEGORY_ORDER.filter((key) => key !== 'OTHER').flatMap((key) => EMOJI_CATEGORIES[key]!.emojis);

/** Words of a text, normalized ("Péage A6 !" gives "peage a6"), padded for whole-word lookups. */
function words(text: string): string {
    return ` ${normalize(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
}

/**
 * The emoji an expense description calls for ("Resto italien" gives 🍽️,
 * "Plein d'essence" ⛽), or null when nothing stands out. The common words
 * first, by their first appearance in the description, then the CLDR names
 * of the expense emojis (`keywords`, see loadKeywords) for longer words.
 */
export function suggestEmoji(description: string, keywords: Record<string, string>[] = []): string | null {
    const text = words(description);
    if (text.trim().length < 2) return null;

    let best: { emoji: string; at: number } | null = null;
    for (const [emoji, terms] of COMMON_EXPENSE_WORDS) {
        for (const term of terms) {
            const at = text.indexOf(` ${term} `);
            if (at !== -1 && (!best || at < best.at)) best = { emoji, at };
        }
    }
    if (best) return best.emoji;

    // Short words match too much by prefix ("bar" in "barbecue").
    for (const word of text.trim().split(' ')) {
        if (word.length < 5) continue;
        const found = searchEmojis(word, EXPENSE_EMOJIS, keywords)[0];
        if (found) return found;
    }
    return null;
}
