import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';

/// Icons for the keys of the admin panel's cloth icon library (items.icon / categories.icon).
/// The admin uses Game Icons; the closest Font Awesome / Material icon is used here.
final Map<String, IconData> _iconsByKey = {
  for (final k in ['shirt', 'tshirt', 'polo', 'kurta', 'top', 'tank-top', 'hoodie', 'sweater']) k: FontAwesomeIcons.shirt.data,
  for (final k in ['trousers', 'jeans', 'shorts', 'underwear', 'boxers', 'belt', 'robe', 'dupatta', 'hanger']) k: Icons.checkroom,
  for (final k in ['skirt', 'dress', 'gown', 'frock', 'lehenga', 'saree']) k: FontAwesomeIcons.personDress.data,
  for (final k in ['jacket', 'coat', 'overcoat', 'waistcoat', 'leather-vest']) k: FontAwesomeIcons.vest.data,
  for (final k in ['suit', 'tie', 'bow-tie']) k: FontAwesomeIcons.userTie.data,
  'baby': FontAwesomeIcons.baby.data,
  'kids-dress': FontAwesomeIcons.childDress.data,
  'socks': FontAwesomeIcons.socks.data,
  for (final k in ['cap', 'hat', 'winter-hat']) k: FontAwesomeIcons.hatCowboy.data,
  for (final k in ['gloves', 'winter-gloves']) k: FontAwesomeIcons.mitten.data,
  'soft-toy': Icons.toys_outlined,
  for (final k in ['shoes', 'sneakers', 'boots', 'heels', 'sandals']) k: FontAwesomeIcons.shoePrints.data,
  for (final k in ['handbag', 'bag', 'school-bag']) k: FontAwesomeIcons.bagShopping.data,
  'backpack': Icons.backpack_outlined,
  for (final k in ['bed', 'double-bed', 'blanket']) k: Icons.king_bed_outlined,
  'single-bed': Icons.single_bed_outlined,
  for (final k in ['pillow', 'mattress']) k: FontAwesomeIcons.mattressPillow.data,
  for (final k in ['curtain', 'door-curtain']) k: Icons.curtains_outlined,
  'window': Icons.window_outlined,
  'towel': Icons.dry_cleaning_outlined,
  'sofa': FontAwesomeIcons.couch.data,
  'carpet': FontAwesomeIcons.rug.data,
  'table-cloth': Icons.table_restaurant_outlined,
  'clothes': FontAwesomeIcons.shirtsinbulk.data,
  'wash': Icons.local_laundry_service_outlined,
  'iron': Icons.iron_outlined,
  'dry-clean': Icons.dry_cleaning_outlined,
};

/// Same rules as the admin panel's clothIcons.js, so an item without its own icon gets the same kind of icon.
const _nameRules = <(String, String)>[
  (r'\bt-?shirt|\btee\b', 'tshirt'), ('polo', 'polo'), ('kurta|kurti', 'kurta'), ('hoodie|sweatshirt', 'hoodie'),
  (r'blouse|\btops?\b|camisole', 'top'), (r'tank|singlet|\bvest\b|baniyan|banian', 'tank-top'), ('shirt', 'shirt'),
  ('jean|denim', 'jeans'), ('pant|trouser|pyjama|pajama|legging|chino|salwar|dhoti', 'trousers'), ('boxer', 'boxers'),
  (r'underwear|innerwear|brief|panty|panties|lingerie|\bbra\b', 'underwear'), ('short', 'shorts'), ('skirt', 'skirt'),
  ('gown', 'gown'), ('frock', 'frock'), ('lehenga|ghagra|choli', 'lehenga'), ('dress', 'dress'),
  (r'saree|\bsari\b|kimono', 'saree'), ('dupatta|stole|shawl|scarf|muffler|fabric', 'dupatta'),
  ('robe|nighty|nightwear|nightgown', 'robe'), ('sherwani|achkan|overcoat|trench', 'overcoat'), ('waistcoat|nehru', 'waistcoat'),
  (r'\bsuits?\b|tuxedo', 'suit'), ('blazer|jacket|windcheater|parka', 'jacket'), (r'\bcoat', 'coat'),
  ('knit|sweater|wool|cardigan|pullover|jumper', 'sweater'), ('bow ?tie', 'bow-tie'), (r'\btie\b', 'tie'), ('belt', 'belt'),
  ('beanie|woollen cap|monkey cap', 'winter-hat'), (r'\bcap\b', 'cap'), (r'\bhat\b', 'hat'), ('mitten|winter glove', 'winter-gloves'),
  ('glove', 'gloves'), ('sock|stocking', 'socks'), ('sneaker|canvas', 'sneakers'), ('boot', 'boots'), ('heel', 'heels'),
  ('sandal|slipper|chappal|flip', 'sandals'), ('shoe', 'shoes'), ('handbag|purse|clutch', 'handbag'), ('backpack|rucksack', 'backpack'),
  ('school ?bag', 'school-bag'), ('bag', 'bag'), ('teddy|soft toy|plush|toy', 'soft-toy'), ('mattress', 'mattress'),
  ('pillow|cushion', 'pillow'), ('blanket|quilt|duvet|comforter|razai|rajai|dohar', 'blanket'),
  ('(double|king|queen).*(bed|sheet)|(bed|sheet).*(double|king|queen)', 'double-bed'), ('single.*(bed|sheet)|(bed|sheet).*single', 'single-bed'),
  ('bed|sheet|linen', 'bed'), ('door curtain|drape', 'door-curtain'), ('blind', 'window'), ('curtain', 'curtain'),
  ('towel|napkin', 'towel'), ('sofa|couch', 'sofa'), (r'carpet|\brug\b|\bmat\b|doormat', 'carpet'),
  ('table ?cloth|table cover|table runner', 'table-cloth'), ('baby|infant|romper|onesie|newborn', 'baby'), (r'\bkids?\b|child', 'kids-dress'),
  ('dry ?clean', 'dry-clean'), ('iron|press', 'iron'), ('wash|laundry|fold', 'wash'),
];

String? iconKeyForName(String name) {
  for (final (pattern, key) in _nameRules) {
    if (RegExp(pattern, caseSensitive: false).hasMatch(name)) return key;
  }
  return null;
}

/// The item's own icon, else one from its name, else its category's, else a hanger.
IconData iconFor({String? icon, String? name, String? categoryIcon}) =>
    _iconsByKey[icon] ?? _iconsByKey[iconKeyForName(name ?? '')] ?? _iconsByKey[categoryIcon] ?? Icons.checkroom;

/// Item picture: its image if it has one, else its icon on a soft peach tile (as in the admin POS).
class ItemVisual extends StatelessWidget {
  const ItemVisual({super.key, this.imageUrl, this.icon, this.name, this.categoryIcon, this.size = 64});

  final String? imageUrl;
  final String? icon;
  final String? name;
  final String? categoryIcon;
  final double size;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(size * 0.25);
    final url = mediaUrl(imageUrl);
    final fallback = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.16), borderRadius: radius),
      alignment: Alignment.center,
      child: Icon(iconFor(icon: icon, name: name, categoryIcon: categoryIcon), size: size * 0.5, color: AppColors.secondary),
    );
    if (url == null) return fallback;
    return ClipRRect(
      borderRadius: radius,
      child: CachedNetworkImage(
        imageUrl: url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        placeholder: (_, _) => fallback,
        errorWidget: (_, _, _) => fallback,
      ),
    );
  }
}
