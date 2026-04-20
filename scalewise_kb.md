ScaleWise AI
Comprehensive Technical Specification & Functional Architecture
Table of Contents
Onboarding & Intelligent Profiling

Visual Nutritional Intelligence (Gemini 1.5)

The Dynamic Daily Diet Architect

Multi-Modal Activity & MET Analytics

The Tax Negotiator & Behavioral Tools

Cheat Day & Indulgence Management

Safety, Recovery & Vital Monitoring

Proactive Automation & Partner Accountability

Hybrid Interface Architecture (Bot + TMA)

Technical Implementation & Deployment

1. Onboarding & Intelligent Profiling
Feature: Universal Profile Wizard
The system initiates a conversational data-collection sequence to establish a user's biological and lifestyle baseline.

Sub-Features & Technical Pointers:

Goal Path Selection: Toggles between "Calorie Deficit" (Fat Loss) and "Calorie Surplus" (Weight Gain/Bulking).

Biometric Vitals: Captures Age, Height, Weight, and Gender for BMR calculation.

TDEE Estimation: Factors in baseline activity levels to set maintenance anchors.

Dietary Archetyping: Supports Vegetarian, Vegan, Jain, and Non-Veg with regional culinary tagging.

2. Visual Nutritional Intelligence
Feature: Gemini-Powered Vision Auditor
Uses multimodal LLMs to interpret food imagery and restaurant menus.

Sub-Features & Technical Pointers:

Image-to-Macro Mapping: Identifies regional Indian foods and estimates portion size.

Restaurant Rescue: Analyzes physical menus to identify goal-aligned choices.

Kitchen Assistant: Generates macro-compliant recipes from available pantry items.

3. The Dynamic Daily Diet Architect
Feature: Rolling Recommendation Engine
A non-linear meal planning system that adjusts in real-time based on actual daily consumption and weight velocity.

Sub-Features & Technical Pointers:

Morning Blueprint: Daily 7:00 AM plan tailored to weight velocity.

Reactive Menu Adjustment: Dynamically simplifies upcoming meals if earlier logs exceed limits.

Protein-First Nudges: Tracks targets hourly and suggests "Protein Rescues."

4. Multi-Modal Activity & MET Analytics
Feature: Advanced Activity Parser
Standardizes energy expenditure using MET (Metabolic Equivalent of Task) formulas.

Sub-Features & Technical Pointers:

MET Formula Implementation: (MET x Weight_kg x Duration_hr) calculation for all activities.

Gym & Equipment Logging: Recognizes specific equipment and strength movements.

Energy-Out Balancing: Automatically scales calorie budgets post-activity.

5. The Tax Negotiator & Behavioral Tools
Feature: Cravings & Impulse Management
Uses behavioral science to turn impulses into measurable trade-offs.

Sub-Features & Technical Pointers:

Step Tax: Converts snack calories into required walking distances.

Gains Tax: Converts missed meals into high-density nutritional requirements.

Urge Surfing (/crave): Guided psychological intervention to manage cravings.

6. Cheat Day & Indulgence Management
Feature: Structured Indulgence Framework
Integrates managed "cheat days" into the long-term plan to ensure sustainability without losing progress.

Sub-Features & Technical Pointers:

Calorie Banking: Logic to "save" 100-200 kcal/day leading up to a scheduled cheat event.

Harm Reduction (Gemini Vision): Menu analysis to suggest the "best of the bad" choices.

Sodium Correlation: Explicitly flags post-cheat weight spikes as water retention to protect morale.

Recovery Pivot: Automated morning-after menu focusing on hydration, high-protein, and low-sodium flushing.

User Experience: "/cheat set saturday" leads to: "Indulgence scheduled! We'll increase your step target by 2k for the next 3 days to bank some energy."

7. Safety, Recovery & Vital Monitoring
Feature: Injury & Vital Safeguard
Protects users from physical burnout and deceptive scale readings.

Sub-Features & Technical Pointers:

Active Recovery Triggers: Forces rest days after high-impact streaks.

Hydration Guard: Warns about sodium-driven weight spikes.

Periodic Metric Comparison: Compares current body metrics against tracked progress trends to validate velocity.

8. Proactive Automation & Partner Accountability
Feature: Consistency & Social Layer

Time-Buffered Nudges: Alerts for missing logs.

The Buddy System: Social intervention if logs are inactive for 48 hours.

Streak Engine: Visual badges for consistency.

9. Hybrid Interface Architecture (Bot + TMA)
Feature: Dual-Layer UI Strategy

Telegram Bot: 100% of logs, photos, and active nudges.

Telegram Mini App (TMA): Dashboard for analyzing Weight Velocity, Nutritional Trends, and Activity Heatmaps.

10. Technical Implementation & Deployment
Runtime: Node.js (grammY framework).

AI Engine: Google Generative AI (Gemini 1.5 Flash).

Database: PostgreSQL (Prisma ORM).

Hosting: Vercel (Mini App) + Railway (Bot Backend).

ScaleWise AI | Technical Document © 2026