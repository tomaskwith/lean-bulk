// All the plan content lives here. Edit this file to change targets, exercises or meals.

export const PEOPLE = {
  tom: { name: 'Tom', kcal: 3500, protein: 170 },
  joe: { name: 'Joe', kcal: 3150, protein: 165 },
};

export const ORDER = ['A', 'B', 'C', 'D', 'E'];

// Sessions run in order A→E on whatever days suit. Plate colours match bumper plates.
export const PROGRAM = {
  A: { name: 'Quads & Push', plate: '--pA', ex: [
    { id: 'squat', n: 'Back squat', r: '6–8', e: '1 RIR', rest: '3 min', kit: 'Squat rack / rig', swap: 'Smith squat or perfect squat machine' },
    { id: 'incdb', n: 'Incline dumbbell press', r: '6–10', e: '0–1 RIR', rest: '2–3 min', kit: 'Adjustable bench + DBs', swap: 'Incline Smith press' },
    { id: 'legext', n: 'Leg extension', r: '10–15', e: 'Failure + drop set on set 2', rest: '90 s', kit: 'Leg extension', swap: 'Sissy squat or Smith squat, heels raised' },
    { id: 'cablerow', n: 'Seated cable row', r: '8–12', e: 'Failure', rest: '2 min', kit: 'Low cable row', swap: 'Chest-supported DB row' },
    { id: 'cablelat', n: 'Cable lateral raise', r: '12–20', e: 'Failure', rest: '60 s', kit: 'Cable stack', swap: 'DB lateral raise' },
    { id: 'inccurl', n: 'Incline dumbbell curl', r: '8–12', e: 'Failure', rest: '90 s', kit: 'Bench + DBs', swap: 'Bayesian cable curl' },
    { id: 'cablecrunch', n: 'Cable crunch', r: '10–15', e: 'Failure', rest: '60 s', kit: 'Cable + rope', swap: 'Weighted decline crunch' },
  ]},
  B: { name: 'Upper Strength', plate: '--pB', ex: [
    { id: 'bench', n: 'Barbell bench press', r: '5–8', e: '1 RIR', rest: '3 min', kit: 'Bench in rig', swap: 'Smith bench or DB bench' },
    { id: 'pullup', n: 'Pull-up (add weight past 10 reps)', r: '6–10', e: '0–1 RIR', rest: '2–3 min', kit: 'Rig pull-up bar', swap: 'Lat pulldown' },
    { id: 'cablefly', n: 'Chest fly machine', r: '10–15', e: 'Failure, 1 s squeeze', rest: '90 s', kit: 'Pec deck / chest fly machine', swap: 'Cable fly, high to low' },
    { id: 'sarow', n: 'Single-arm cable row', r: '10–12', e: 'Failure', rest: '90 s', kit: 'Cable stack', swap: 'Single-arm DB row' },
    { id: 'ohtri', n: 'Overhead cable triceps extension', r: '10–15', e: 'Failure', rest: '90 s', kit: 'Cable + rope', swap: 'DB overhead extension' },
    { id: 'bayes', n: 'Bayesian cable curl', r: '10–15', e: 'Failure', rest: '90 s', kit: 'Cable stack', swap: 'Incline DB curl' },
    { id: 'hlr', n: 'Hanging leg raise', r: '8–15', e: 'Failure', rest: '60 s', kit: "Rig / captain's chair", swap: 'Lying leg raise' },
  ]},
  C: { name: 'Posterior & Pull', plate: '--pC', ex: [
    { id: 'rdl', n: 'Romanian deadlift', r: '6–10', e: '1 RIR', rest: '3 min', kit: 'Barbell / rig', swap: 'DB RDL' },
    { id: 'lyingcurl', n: 'Lying leg curl', r: '8–12', e: 'Failure', rest: '90 s', kit: 'Leg curl', swap: 'Seated leg curl or Nordic negatives' },
    { id: 'legpress', n: 'Leg press', r: '10–15', e: 'Failure', rest: '2 min', kit: 'Leg press', swap: 'Hack/perfect squat machine' },
    { id: 'pulldown', n: 'Neutral-grip lat pulldown', r: '8–12', e: 'Failure', rest: '2 min', kit: 'Lat pulldown', swap: 'Assisted pull-up' },
    { id: 'chestpress', n: 'Machine chest press', r: '8–12', e: 'Failure', rest: '2 min', kit: 'Chest press', swap: 'DB flat press' },
    { id: 'ezcurl', n: 'EZ-bar curl', r: '6–10', e: 'Failure', rest: '90 s', kit: 'EZ bar', swap: 'Straight bar or cable curl' },
    { id: 'calf', n: 'Standing calf raise (superset with crunches)', r: '8–12', e: 'Failure, 2 s pause at bottom', rest: '60 s', kit: 'Smith / calf machine', swap: 'Leg press calf raise' },
  ]},
  D: { name: 'Upper Volume', plate: '--pD', ex: [
    { id: 'dbshoulder', n: 'Seated dumbbell shoulder press', r: '6–10', e: '0–1 RIR', rest: '2–3 min', kit: 'Bench + DBs', swap: 'Machine shoulder press' },
    { id: 'csrow', n: 'Chest-supported row', r: '8–12', e: 'Failure', rest: '2 min', kit: 'Incline bench + DBs', swap: 'T-bar or machine row' },
    { id: 'incsmith', n: 'Incline Smith press', r: '8–12', e: 'Failure', rest: '2 min', kit: 'Smith machine', swap: 'Incline DB press' },
    { id: 'dblat', n: 'Dumbbell lateral raise', r: '12–20', e: 'Failure', rest: '60 s', kit: 'DBs', swap: 'Machine lateral raise' },
    { id: 'preacher', n: 'Preacher curl', r: '8–12', e: 'Failure', rest: '90 s', kit: 'Preacher bench / machine', swap: 'Spider curl on incline bench' },
    { id: 'pushdown', n: 'Triceps rope pushdown', r: '10–15', e: 'Failure', rest: '60 s', kit: 'Cable + rope', swap: 'Bar pushdown' },
    { id: 'abwheel', n: 'Ab wheel rollout', r: '6–15', e: 'Failure', rest: '60 s', kit: 'Ab wheel', swap: 'Long-lever plank, 2 × 45 s' },
  ]},
  E: { name: 'Legs & Arms', plate: '--pE', ex: [
    { id: 'hack', n: 'Hack / perfect squat machine', r: '6–10', e: '1 RIR', rest: '3 min', kit: 'Perfect squat machine', swap: 'Smith squat or leg press' },
    { id: 'bss', n: 'Bulgarian split squat (DB)', r: '8–12 / leg', e: '0–1 RIR', rest: '2 min', kit: 'Bench + DBs', swap: 'Smith split squat' },
    { id: 'seatcurl', n: 'Seated leg curl', r: '10–15', e: 'Failure', rest: '90 s', kit: 'Seated leg curl', swap: 'Lying leg curl' },
    { id: 'legext2', n: 'Leg extension', r: '12–15', e: 'Failure', rest: '90 s', kit: 'Leg extension', swap: 'Leg press, narrow stance' },
    { id: 'seatcalf', n: 'Seated calf raise', r: '10–15', e: 'Failure', rest: '60 s', kit: 'Seated calf / Smith', swap: 'DB on knee, seated' },
    { id: 'hammer', n: 'Rope hammer curl', r: '8–12', e: 'Failure', rest: '90 s', kit: 'Cable + rope', swap: 'DB hammer curl' },
    { id: 'cablecrunch2', n: 'Cable crunch', r: '10–15', e: 'Failure', rest: '60 s', kit: 'Cable + rope', swap: 'Weighted decline crunch' },
  ]},
};

export const VOLUME = [
  ['Quads', '12 + split squats', 'A, C, E'],
  ['Hamstrings', '6 + RDL/split squat carryover', 'C, E'],
  ['Biceps', '10 direct + rows/pulldowns', 'Every session'],
  ['Abs', '10', 'Every session'],
  ['Chest', '10', 'A, B, C, D'],
  ['Back', '10', 'A, B, C, D'],
  ['Shoulders (side)', '4 + all pressing', 'A, D'],
  ['Triceps', '4 + all pressing', 'B, D'],
  ['Calves', '4', 'C, E'],
];

// [when, meal, kcal, P, C, F] per person, because breakfasts differ.
// 'lunch' and 'dinner' are filled in from this week's meal plan (see COOKS below).
const SNACK = ['15:00', 'Pre-gym: bagel + 25 g peanut butter', 380, 15, 48, 14];
const YOG = ['21:30', '200 g 0% Greek yoghurt + 40 g granola', 294, 24, 32, 7];

export const MEALS = {
  tom: [
    ['8:00', 'Mass oats: 100 g oats, 250 ml whole milk, 20 g PB, banana, 15 g honey', 812, 28, 111, 27],
    ['12:00', 'lunch'], SNACK, ['19:00', 'dinner'], YOG,
    ['Evening', 'Shake: 400 ml whole milk + 30 g whey', 376, 37, 21, 16],
  ],
  joe: [
    ['8:00', 'Bacon baps: 2 white baps, 6 rashers back bacon, 20 g brown sauce or ketchup, 200 ml orange juice', 797, 42, 82, 34],
    ['12:00', 'lunch'], SNACK, ['19:00', 'dinner'], YOG,
  ],
};

// Two batch cooks a week. Tubs needed = days covered × 2 people.
export const COOKS = {
  sun: { name: 'Sunday cook', covers: 'Mon–Wed', tubs: 6 },
  wed: { name: 'Wednesday cook', covers: 'Thu–Sun', tubs: 8 },
};
export const DEFAULT_PLAN = { sun: { lunch: 'peri', dinner: 'bigmac' }, wed: { lunch: 'katsu', dinner: 'doner' } };

// Starter recipes. The live library is in Supabase (seeded from supabase/schema.sql) and edited in the app;
// these are only used when no database is connected. m = [kcal, P, C, F] per tub.
export const RECIPES = [
  { id: 'peri', t: 'Peri chicken & spicy rice', tubs: 6, m: [868, 47, 97, 31],
    ing: ['1.2 kg boneless skinless chicken thighs', '2 tbsp peri-peri seasoning (or 1 tbsp smoked paprika, 1 tsp chilli flakes, 1 tsp garlic granules, 1 tsp oregano), juice of 1 lemon, 1 tbsp oil, salt', '660 g rice, 1 tsp turmeric, 1 tsp paprika, 1 chicken stock cube', '480 g frozen peas & sweetcorn', 'Peri mayo: 120 g light mayo + 1 tsp peri seasoning + squeeze of lemon'],
    steps: ['Toss the thighs in the seasoning, lemon and oil. Leave 20 min, or overnight if you remember.', 'Air fry at 200°C for 18–22 min, flipping halfway, until 75°C inside. Do it in two batches.', 'Boil the rice with turmeric, paprika and the stock cube. Stir the peas and sweetcorn in for the last 3 min.', "Split into 6 tubs: about 200 g raw-weight chicken each. Mayo goes in little pots so the rice doesn't go soggy."] },
  { id: 'bigmac', t: 'Big Mac bowl', tubs: 6, m: [790, 48, 58, 40],
    ing: ['1.08 kg 12% beef mince', '1.8 kg potatoes, cubed, 2 tbsp oil, salt, garlic granules', '1 onion, finely diced', '150 g mature cheddar, grated', '1 iceberg lettuce, gherkins', 'Sauce: 90 g light mayo, 30 g ketchup, 1 tbsp mustard, 3 chopped gherkins + a splash of the jar vinegar'],
    steps: ['Air fry the potatoes at 200°C for 20–25 min, shaking twice. Do it in batches.', "Brown the mince hard with the onion, salt and black pepper. Drain off a little fat if it's swimming.", 'Tub it up: potatoes, mince, cheese on top. Lettuce, gherkins and sauce go in a separate pot.', 'Reheat until piping hot, then add the cold lettuce and sauce.'] },
  { id: 'katsu', t: 'Chicken katsu curry', tubs: 8, m: [843, 62, 124, 10],
    ing: ['1.6 kg chicken breast, butterflied and flattened', '240 g panko, 2 eggs beaten, oil spray', '800 g rice', 'Sauce: 2 onions + 2 carrots diced, 3 tbsp mild curry powder, 1 tsp garlic granules, 1 tsp ginger, 80 g plain flour, 1 L chicken stock, 2 tbsp soy, 80 g honey'],
    steps: ['Dip the chicken in egg, then panko. Spray with oil. Air fry at 200°C for 12–15 min until 75°C inside.', 'Soften the onion and carrot for 8 min. Stir in the spices and flour for 1 min, then whisk in stock, soy and honey. Simmer 15 min and blitz with the hand blender.', 'Cook the rice. Tub the rice and sliced chicken, with sauce in a separate pot so the coating stays crisp.', "If you're at home, reheat the chicken in the air fryer at 180°C for 5 min."] },
  { id: 'doner', t: 'Doner kebab & chips', tubs: 8, m: [846, 52, 80, 34],
    ing: ['1.44 kg 12% beef mince (swap some for lamb if it\'s cheap)', '1 onion grated and squeezed dry, 2 tsp each garlic granules, cumin, coriander, smoked paprika, salt; 1 tsp oregano, 1 tsp black pepper', '2 kg potatoes cut into chips, 2 tbsp oil', '8 large wraps', 'Garlic sauce: 480 g 0% Greek yoghurt, 80 g light mayo, 2 grated garlic cloves, lemon, dried mint, salt', 'Lettuce, red onion, chilli sauce if you want it'],
    steps: ["Mix the mince and spices and knead for 5 min until it's sticky and paste-like. That's what gives it the doner texture.", 'Press into two loaf tins or tight foil logs. Bake at 180°C for 60–70 min until 75°C inside. Rest it, then slice as thin as you can.', 'Chips: air fry at 200°C for 20–25 min in batches.', 'To eat, crisp the doner slices in the air fryer at 200°C for 4–5 min, then load a wrap with salad and garlic sauce, chips on the side.'] },
];

// The cook lists are built from the week's meal plan; these are the fixed weekly staples.
export const SHOP = [
  { t: 'Tom’s staples (per week)', items: ['Oats – 700 g', 'Whole milk – 4.5 L (breakfast + shake)', 'Bananas – 7', 'Honey – a squeezy bottle lasts ~3 weeks', 'Peanut butter – 315 g', 'Bagels – 7', '0% Greek yoghurt – 1.4 kg', 'Granola – 280 g', 'Whey – 210 g (7 scoops)', 'Creatine – 5 g/day'] },
  { t: 'Joe’s staples (per week)', items: ['White baps – 14', 'Smoked back bacon – 42 rashers (~1.3 kg)', 'Orange juice – 1.4 L', 'Brown sauce or ketchup', 'Peanut butter – 175 g', 'Bagels – 7', '0% Greek yoghurt – 1.4 kg', 'Granola – 280 g', 'Creatine – 5 g/day'] },
];
