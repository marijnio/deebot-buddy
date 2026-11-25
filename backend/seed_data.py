"""Initial seed data for Deebot Buddy (ECOVACS DEEBOT T90 PRO OMNI)."""

INITIAL_INVENTORY = [
    {
        "slug": "dust_bags",
        "name": "Antibacterial Dust Bags",
        "unit_label": "bags",
        "in_stock": 3,
        "low_stock_threshold": 1,
        "notes": "Self-sealing OMNI station dust bags",
    },
    {
        "slug": "filters",
        "name": "Dustbin Antibacterial Filters",
        "unit_label": "filters",
        "in_stock": 2,
        "low_stock_threshold": 1,
        "notes": "Rotate between two filters so washed ones can air-dry 24h",
    },
    {
        "slug": "roller_mops",
        "name": "Washable Roller Mops",
        "unit_label": "rollers",
        "in_stock": 2,
        "low_stock_threshold": 1,
        "notes": "OZMO Roller mop pads",
    },
    {
        "slug": "main_brush",
        "name": "Main Anti-Tangle Brush",
        "unit_label": "brushes",
        "in_stock": 1,
        "low_stock_threshold": 1,
        "notes": "ZeroTangle main roller brush",
    },
    {
        "slug": "side_brushes",
        "name": "Side Brushes",
        "unit_label": "brushes",
        "in_stock": 2,
        "low_stock_threshold": 1,
        "notes": "Edge-sweeping side brush",
    },
    {
        "slug": "cleaning_solution",
        "name": "Official ECOVACS Cleaning Solution",
        "unit_label": "bottles",
        "in_stock": 2,
        "low_stock_threshold": 1,
        "notes": "Use official low-foam ECOVACS floor cleaning solution only",
    },
]

INITIAL_TASKS = [
    {
        "slug": "dirty_water_tank",
        "name": "Dirty Water Tank",
        "location": "OMNI Station",
        "sort_order": 1,
        "clean_interval_days": 3,
        "replace_interval_days": None,
        "inventory_slug": None,
        "is_critical_water": 1,
        "icon": "droplets",
        "instructions": (
            "Empty dirty water and rinse thoroughly after every 1–2 mopping runs "
            "to prevent odors and biofilm buildup."
        ),
    },
    {
        "slug": "clean_water_tank",
        "name": "Clean Water Tank",
        "location": "OMNI Station",
        "sort_order": 2,
        "clean_interval_days": 30,
        "replace_interval_days": None,
        "inventory_slug": None,
        "is_critical_water": 0,
        "icon": "waves",
        "instructions": (
            "Refill with clean tap water as needed; rinse interior monthly. "
            "Never add third-party soaps directly into this tank."
        ),
    },
    {
        "slug": "drip_tray",
        "name": "Drip Tray (Robot)",
        "location": "Robot",
        "sort_order": 3,
        "clean_interval_days": 7,
        "replace_interval_days": None,
        "inventory_slug": None,
        "is_critical_water": 0,
        "icon": "tray",
        "instructions": (
            "Remove the drip tray from the robot, empty residual dirty water/debris, "
            "rinse with water, and air-dry."
        ),
    },
    {
        "slug": "mop_washing_trays",
        "name": "Mop Washing & Soaking Trays",
        "location": "OMNI Station",
        "sort_order": 4,
        "clean_interval_days": 7,
        "replace_interval_days": None,
        "inventory_slug": None,
        "is_critical_water": 0,
        "icon": "sparkles",
        "instructions": (
            "Pull out the washing and soaking trays from the station base, "
            "scrub away sludge/hair, and rinse thoroughly."
        ),
    },
    {
        "slug": "main_brush",
        "name": "Main Brush & Brush Comb",
        "location": "Robot",
        "sort_order": 5,
        "clean_interval_days": 7,
        "replace_interval_days": 270,
        "inventory_slug": "main_brush",
        "is_critical_water": 0,
        "icon": "brush",
        "instructions": (
            "Unclip brush cover, remove the anti-tangle roller and comb, "
            "clear wrapped hair/threads, and ensure it is dry before reinstalling."
        ),
    },
    {
        "slug": "dustbin_filter",
        "name": "Dustbin Filter (Antibacterial)",
        "location": "Robot",
        "sort_order": 6,
        "clean_interval_days": 7,
        "replace_interval_days": 120,
        "inventory_slug": "filters",
        "is_critical_water": 0,
        "icon": "filter",
        "instructions": (
            "Tap out dust. If washed with water, air-dry completely for 24 hours "
            "before reinstalling (rotate with a spare)."
        ),
    },
    {
        "slug": "side_brush",
        "name": "Side Brush",
        "location": "Robot",
        "sort_order": 7,
        "clean_interval_days": 14,
        "replace_interval_days": 120,
        "inventory_slug": "side_brushes",
        "is_critical_water": 0,
        "icon": "fan",
        "instructions": (
            "Pull off or unscrew the side brush and remove hair tangled around the spindle."
        ),
    },
    {
        "slug": "washable_roller_mop",
        "name": "Washable Roller Mop",
        "location": "Robot",
        "sort_order": 8,
        "clean_interval_days": 14,
        "replace_interval_days": 45,
        "inventory_slug": "roller_mops",
        "is_critical_water": 0,
        "icon": "disc",
        "instructions": (
            "Station self-washes after runs. For manual deep cleaning: undock robot, "
            "double-tap the power button to extend the mop housing, press the lateral "
            "unlock button, and slide the roller off to clean inside the housing."
        ),
    },
    {
        "slug": "caster_drive_wheels",
        "name": "Universal Caster & Drive Wheels",
        "location": "Robot",
        "sort_order": 9,
        "clean_interval_days": 30,
        "replace_interval_days": None,
        "inventory_slug": None,
        "is_critical_water": 0,
        "icon": "circle-dot",
        "instructions": (
            "Pry out the front caster wheel to remove hair from the axle; "
            "wipe treads on both main drive wheels."
        ),
    },
    {
        "slug": "sensors_camera_bumper",
        "name": "Sensors, Camera & Bumper",
        "location": "Robot",
        "sort_order": 10,
        "clean_interval_days": 30,
        "replace_interval_days": None,
        "inventory_slug": None,
        "is_critical_water": 0,
        "icon": "eye",
        "instructions": (
            "Wipe Anti-drop sensors (bottom), Edge sensor, Carpet sensor, AIVI camera, "
            "Obstacle avoidance module, and Bumper with a clean, **dry** cloth."
        ),
    },
    {
        "slug": "charging_contacts_ir",
        "name": "Charging Contacts & IR Interface",
        "location": "Both",
        "sort_order": 11,
        "clean_interval_days": 30,
        "replace_interval_days": None,
        "inventory_slug": None,
        "is_critical_water": 0,
        "icon": "zap",
        "instructions": (
            "Wipe the metal charging pins and IR windows on both the robot and OMNI "
            "station with a clean, **dry** cloth."
        ),
    },
    {
        "slug": "cleaning_solution_reservoir",
        "name": "Cleaning Solution Reservoir",
        "location": "OMNI Station",
        "sort_order": 12,
        "clean_interval_days": 30,
        "replace_interval_days": None,
        "inventory_slug": "cleaning_solution",
        "is_critical_water": 0,
        "icon": "flask",
        "instructions": (
            "Open the station dust collection cover and check the solution tank level; "
            "top up with official ECOVACS cleaning solution."
        ),
    },
    {
        "slug": "antibacterial_dust_bag",
        "name": "Antibacterial Dust Bag",
        "location": "OMNI Station",
        "sort_order": 13,
        "clean_interval_days": None,
        "replace_interval_days": 60,
        "inventory_slug": "dust_bags",
        "is_critical_water": 0,
        "icon": "package",
        "instructions": (
            "Pull out the full bag (it self-seals automatically) and slide a new "
            "antibacterial dust bag into the station slot."
        ),
    },
    {
        "slug": "battery_deep_storage",
        "name": "Battery & Deep Storage Check",
        "location": "Robot",
        "sort_order": 14,
        "clean_interval_days": 45,
        "replace_interval_days": 540,
        "inventory_slug": None,
        "is_critical_water": 0,
        "icon": "battery",
        "instructions": (
            "Keep docked during regular use. If storing long-term, charge to 100%, "
            "turn the physical power switch OFF, and recharge every 6 weeks."
        ),
    },
]

DEFAULT_SETTINGS = {
    "robot_name": "Deebot T90 PRO OMNI",
    "webhook_url": "",
    "webhook_type": "auto",
    "pushover_token": "",
    "pushover_user": "",
    "notifications_enabled": "false",
}
