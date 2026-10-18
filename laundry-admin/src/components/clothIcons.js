import { TbHanger, TbWashDryclean } from 'react-icons/tb';
import {
  GiShirt, GiTShirt, GiPoloShirt, GiSleevelessTop, GiTankTop, GiHoodie, GiWool,
  GiTrousers, GiShorts, GiSkirt,
  GiDress, GiLargeDress, GiAmpleDress, GiTravelDress, GiKimono, GiRolledCloth, GiRobe,
  GiMonclerJacket, GiLabCoat, GiPirateCoat, GiSleevelessJacket, GiLeatherVest,
  GiUnderwear, GiUnderwearShorts, GiSocks,
  GiTie, GiBowTie, GiBelt, GiBilledCap, GiWesternHat, GiWinterHat, GiGloves, GiWinterGloves,
  GiRunningShoe, GiConverseShoe, GiBoots, GiHighHeel, GiSandal, GiHandBag, GiBackpack, GiSchoolBag, GiBeachBag,
  GiBed, GiSleepingBag, GiPillow, GiTheaterCurtains, GiWindow, GiTowel, GiSofa, GiRoundTable, GiClothes,
} from 'react-icons/gi';
import { FaShirt, FaUserTie, FaBaby, FaChildDress, FaMattressPillow, FaRug } from 'react-icons/fa6';
import { PiPantsFill } from 'react-icons/pi';
import { MdToys, MdKingBed, MdSingleBed, MdCurtains, MdLocalLaundryService, MdIron } from 'react-icons/md';

/**
 * Predefined icons for catalogue items and categories. Items and categories store the `key`
 * (items.icon, categories.icon), so keys must never change; add new entries instead.
 */
export const CLOTH_ICONS = [
  // Tops
  { key: 'shirt', label: 'Shirt', group: 'Tops', Icon: GiShirt },
  { key: 'tshirt', label: 'T-shirt', group: 'Tops', Icon: GiTShirt },
  { key: 'polo', label: 'Polo', group: 'Tops', Icon: GiPoloShirt },
  { key: 'kurta', label: 'Kurta / kurti', group: 'Tops', Icon: FaShirt },
  { key: 'top', label: 'Top / blouse', group: 'Tops', Icon: GiSleevelessTop },
  { key: 'tank-top', label: 'Vest / tank top', group: 'Tops', Icon: GiTankTop },
  { key: 'hoodie', label: 'Hoodie / sweatshirt', group: 'Tops', Icon: GiHoodie },
  { key: 'sweater', label: 'Sweater / knitwear', group: 'Tops', Icon: GiWool },

  // Bottoms
  { key: 'trousers', label: 'Trousers / pants', group: 'Bottoms', Icon: GiTrousers },
  { key: 'jeans', label: 'Jeans', group: 'Bottoms', Icon: PiPantsFill },
  { key: 'shorts', label: 'Shorts', group: 'Bottoms', Icon: GiShorts },
  { key: 'skirt', label: 'Skirt', group: 'Bottoms', Icon: GiSkirt },

  // Dresses & ethnic
  { key: 'dress', label: 'Dress', group: 'Dresses & ethnic', Icon: GiDress },
  { key: 'gown', label: 'Gown', group: 'Dresses & ethnic', Icon: GiLargeDress },
  { key: 'frock', label: 'Frock', group: 'Dresses & ethnic', Icon: GiAmpleDress },
  { key: 'lehenga', label: 'Lehenga', group: 'Dresses & ethnic', Icon: GiTravelDress },
  { key: 'saree', label: 'Saree', group: 'Dresses & ethnic', Icon: GiKimono },
  { key: 'dupatta', label: 'Dupatta / stole / fabric', group: 'Dresses & ethnic', Icon: GiRolledCloth },
  { key: 'robe', label: 'Robe / nightwear', group: 'Dresses & ethnic', Icon: GiRobe },

  // Outerwear & formal
  { key: 'jacket', label: 'Jacket / blazer', group: 'Outerwear & formal', Icon: GiMonclerJacket },
  { key: 'suit', label: 'Suit', group: 'Outerwear & formal', Icon: FaUserTie },
  { key: 'coat', label: 'Long coat', group: 'Outerwear & formal', Icon: GiLabCoat },
  { key: 'overcoat', label: 'Sherwani / overcoat', group: 'Outerwear & formal', Icon: GiPirateCoat },
  { key: 'waistcoat', label: 'Waistcoat', group: 'Outerwear & formal', Icon: GiSleevelessJacket },
  { key: 'leather-vest', label: 'Leather jacket / vest', group: 'Outerwear & formal', Icon: GiLeatherVest },

  // Kids & innerwear
  { key: 'baby', label: 'Baby clothes', group: 'Kids & innerwear', Icon: FaBaby },
  { key: 'kids-dress', label: 'Kids wear', group: 'Kids & innerwear', Icon: FaChildDress },
  { key: 'underwear', label: 'Innerwear', group: 'Kids & innerwear', Icon: GiUnderwear },
  { key: 'boxers', label: 'Boxers', group: 'Kids & innerwear', Icon: GiUnderwearShorts },
  { key: 'socks', label: 'Socks', group: 'Kids & innerwear', Icon: GiSocks },

  // Accessories
  { key: 'tie', label: 'Tie', group: 'Accessories', Icon: GiTie },
  { key: 'bow-tie', label: 'Bow tie', group: 'Accessories', Icon: GiBowTie },
  { key: 'belt', label: 'Belt', group: 'Accessories', Icon: GiBelt },
  { key: 'cap', label: 'Cap', group: 'Accessories', Icon: GiBilledCap },
  { key: 'hat', label: 'Hat', group: 'Accessories', Icon: GiWesternHat },
  { key: 'winter-hat', label: 'Woollen cap', group: 'Accessories', Icon: GiWinterHat },
  { key: 'gloves', label: 'Gloves', group: 'Accessories', Icon: GiGloves },
  { key: 'winter-gloves', label: 'Winter gloves', group: 'Accessories', Icon: GiWinterGloves },
  { key: 'soft-toy', label: 'Soft toy', group: 'Accessories', Icon: MdToys },

  // Footwear & bags
  { key: 'shoes', label: 'Sports shoes', group: 'Footwear & bags', Icon: GiRunningShoe },
  { key: 'sneakers', label: 'Sneakers / canvas', group: 'Footwear & bags', Icon: GiConverseShoe },
  { key: 'boots', label: 'Boots', group: 'Footwear & bags', Icon: GiBoots },
  { key: 'heels', label: 'Heels', group: 'Footwear & bags', Icon: GiHighHeel },
  { key: 'sandals', label: 'Sandals / slippers', group: 'Footwear & bags', Icon: GiSandal },
  { key: 'handbag', label: 'Handbag / purse', group: 'Footwear & bags', Icon: GiHandBag },
  { key: 'backpack', label: 'Backpack', group: 'Footwear & bags', Icon: GiBackpack },
  { key: 'school-bag', label: 'School bag', group: 'Footwear & bags', Icon: GiSchoolBag },
  { key: 'bag', label: 'Tote / bag', group: 'Footwear & bags', Icon: GiBeachBag },

  // Home linen
  { key: 'bed', label: 'Bedsheet', group: 'Home linen', Icon: GiBed },
  { key: 'double-bed', label: 'Double bedsheet', group: 'Home linen', Icon: MdKingBed },
  { key: 'single-bed', label: 'Single bedsheet', group: 'Home linen', Icon: MdSingleBed },
  { key: 'blanket', label: 'Blanket / quilt', group: 'Home linen', Icon: GiSleepingBag },
  { key: 'pillow', label: 'Pillow / cushion', group: 'Home linen', Icon: GiPillow },
  { key: 'mattress', label: 'Mattress', group: 'Home linen', Icon: FaMattressPillow },
  { key: 'curtain', label: 'Curtain', group: 'Home linen', Icon: MdCurtains },
  { key: 'door-curtain', label: 'Door curtain / drape', group: 'Home linen', Icon: GiTheaterCurtains },
  { key: 'window', label: 'Window blind', group: 'Home linen', Icon: GiWindow },
  { key: 'towel', label: 'Towel', group: 'Home linen', Icon: GiTowel },
  { key: 'sofa', label: 'Sofa cover', group: 'Home linen', Icon: GiSofa },
  { key: 'carpet', label: 'Carpet / rug', group: 'Home linen', Icon: FaRug },
  { key: 'table-cloth', label: 'Table cloth', group: 'Home linen', Icon: GiRoundTable },

  // Services & general
  { key: 'hanger', label: 'Hanger (general)', group: 'Services & general', Icon: TbHanger },
  { key: 'clothes', label: 'Mixed clothes', group: 'Services & general', Icon: GiClothes },
  { key: 'wash', label: 'Wash & fold', group: 'Services & general', Icon: MdLocalLaundryService },
  { key: 'iron', label: 'Ironing', group: 'Services & general', Icon: MdIron },
  { key: 'dry-clean', label: 'Dry clean', group: 'Services & general', Icon: TbWashDryclean },
];

export const ICON_GROUPS = [...new Set(CLOTH_ICONS.map(i => i.group))];

const BY_KEY = Object.fromEntries(CLOTH_ICONS.map(i => [i.key, i]));

export const clothIcon = (key) => (key && BY_KEY[key]) || null;

// Icon key guessed from an item's name when it has none of its own (first match wins, so specific words go first)
const NAME_RULES = [
  [/\bt-?shirt|\btee\b/i, 'tshirt'],
  [/polo/i, 'polo'],
  [/kurta|kurti/i, 'kurta'],
  [/hoodie|sweatshirt/i, 'hoodie'],
  [/blouse|\btops?\b|camisole/i, 'top'],
  [/tank|singlet|\bvest\b|baniyan|banian/i, 'tank-top'],
  [/shirt/i, 'shirt'],
  [/jean|denim/i, 'jeans'],
  [/pant|trouser|pyjama|pajama|legging|chino|salwar|dhoti/i, 'trousers'],
  [/boxer/i, 'boxers'],
  [/underwear|innerwear|brief|panty|panties|lingerie|\bbra\b/i, 'underwear'],
  [/short/i, 'shorts'],
  [/skirt/i, 'skirt'],
  [/gown/i, 'gown'],
  [/frock/i, 'frock'],
  [/lehenga|ghagra|choli/i, 'lehenga'],
  [/dress/i, 'dress'],
  [/saree|\bsari\b|kimono/i, 'saree'],
  [/dupatta|stole|shawl|scarf|muffler|fabric/i, 'dupatta'],
  [/robe|nighty|nightwear|nightgown/i, 'robe'],
  [/sherwani|achkan|overcoat|trench/i, 'overcoat'],
  [/waistcoat|nehru/i, 'waistcoat'],
  [/\bsuits?\b|tuxedo/i, 'suit'],
  [/blazer|jacket|windcheater|parka/i, 'jacket'],
  [/\bcoat/i, 'coat'],
  [/knit|sweater|wool|cardigan|pullover|jumper/i, 'sweater'],
  [/bow ?tie/i, 'bow-tie'],
  [/\btie\b/i, 'tie'],
  [/belt/i, 'belt'],
  [/beanie|woollen cap|monkey cap/i, 'winter-hat'],
  [/\bcap\b/i, 'cap'],
  [/\bhat\b/i, 'hat'],
  [/mitten|winter glove/i, 'winter-gloves'],
  [/glove/i, 'gloves'],
  [/sock|stocking/i, 'socks'],
  [/sneaker|canvas/i, 'sneakers'],
  [/boot/i, 'boots'],
  [/heel/i, 'heels'],
  [/sandal|slipper|chappal|flip/i, 'sandals'],
  [/shoe/i, 'shoes'],
  [/handbag|purse|clutch/i, 'handbag'],
  [/backpack|rucksack/i, 'backpack'],
  [/school ?bag/i, 'school-bag'],
  [/bag/i, 'bag'],
  [/teddy|soft toy|plush|toy/i, 'soft-toy'],
  [/mattress/i, 'mattress'],
  [/pillow|cushion/i, 'pillow'],
  [/blanket|quilt|duvet|comforter|razai|rajai|dohar/i, 'blanket'],
  [/(double|king|queen).*(bed|sheet)|(bed|sheet).*(double|king|queen)/i, 'double-bed'],
  [/single.*(bed|sheet)|(bed|sheet).*single/i, 'single-bed'],
  [/bed|sheet|linen/i, 'bed'],
  [/door curtain|drape/i, 'door-curtain'],
  [/blind/i, 'window'],
  [/curtain/i, 'curtain'],
  [/towel|napkin/i, 'towel'],
  [/sofa|couch/i, 'sofa'],
  [/carpet|\brug\b|\bmat\b|doormat/i, 'carpet'],
  [/table ?cloth|table cover|table runner/i, 'table-cloth'],
  [/baby|infant|romper|onesie|newborn/i, 'baby'],
  [/\bkids?\b|child/i, 'kids-dress'],
  [/dry ?clean/i, 'dry-clean'],
  [/iron|press/i, 'iron'],
  [/wash|laundry|fold/i, 'wash'],
];

export const iconKeyForName = (name = '') => NAME_RULES.find(([pattern]) => pattern.test(name))?.[1] || null;

/** Icon component for a category: its own key, or a hanger */
export const categoryIcon = (key) => clothIcon(key)?.Icon || TbHanger;

/** Icon component for an item: its own icon, then one guessed from the name, then its category's, then a hanger */
export const itemIcon = ({ icon, name, categoryIcon: categoryKey } = {}) => (
  clothIcon(icon) || clothIcon(iconKeyForName(name)) || clothIcon(categoryKey) || { Icon: TbHanger }
).Icon;
