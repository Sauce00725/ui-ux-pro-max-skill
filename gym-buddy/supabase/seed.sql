-- Sample events for local development (supabase db reset runs this file).
-- Fictional listings at public places across several US metros, dated
-- relative to today so the Events tab always has upcoming items.

with tz(city, state, tz) as (values
  ('Austin', 'TX', 'America/Chicago'), ('New York', 'NY', 'America/New_York'),
  ('Los Angeles', 'CA', 'America/Los_Angeles'), ('Chicago', 'IL', 'America/Chicago'),
  ('Denver', 'CO', 'America/Denver'), ('Miami', 'FL', 'America/New_York'),
  ('Seattle', 'WA', 'America/Los_Angeles'), ('Atlanta', 'GA', 'America/New_York')
),
seed(ext, title, slug, days, start_t, mins, venue, address, city, lng, lat, beginner, cost, cap, descr) as (values
  ('seed-01', 'Sunrise 5K Social Run', 'running', 1, '06:30', 60, 'Lady Bird Lake Trail', 'Auditorium Shores trailhead', 'Austin', -97.7516, 30.2617, true, 0, null::int, 'All paces, no one gets dropped. Coffee after.'),
  ('seed-02', 'Beginner Pickleball Open Play', 'pickleball', 2, '18:00', 120, 'Community Rec Center Courts', null, 'Austin', -97.7300, 30.2850, true, 500, 24, 'Paddles to borrow. We rotate partners every game.'),
  ('seed-03', 'Partner WOD Saturday', 'crossfit', 4, '09:00', 75, 'Eastside Strength Box', null, 'Austin', -97.7150, 30.2640, false, 1500, 30, 'Bring a buddy or get paired up. Scaled options for every movement.'),
  ('seed-04', 'Walk & Talk: Learn the Gym Basics', 'beginner_gym', 3, '17:30', 60, 'Downtown Fitness Hub', null, 'Austin', -97.7431, 30.2672, true, 0, 15, 'A coach walks you through machines, free weights and a starter plan.'),
  ('seed-05', 'Hudson River Tempo Run', 'running', 2, '07:00', 60, 'Hudson River Greenway', 'Pier 45 meetup', 'New York', -74.0110, 40.7330, false, 0, null, '6 miles at tempo with a warm-up mile. Pace groups 7:30 to 10:00.'),
  ('seed-06', 'Rooftop Yoga Flow', 'yoga', 5, '08:00', 60, 'Brooklyn Waterfront Lawn', null, 'New York', -73.9969, 40.7003, true, 1000, 40, 'Vinyasa for every level. Mats provided.'),
  ('seed-07', 'Climbing Meetup: Bouldering Night', 'climbing', 3, '19:00', 120, 'Queens Bouldering Gym', null, 'New York', -73.9400, 40.7480, true, 2200, 25, 'First-timers welcome; shoe rental discount for the group.'),
  ('seed-08', 'Venice Beach Bootcamp', 'hyrox', 1, '07:30', 60, 'Venice Beach Muscle Lawn', null, 'Los Angeles', -118.4730, 33.9850, false, 0, null, 'Sleds, sandbags and sprints. HYROX-style stations.'),
  ('seed-09', 'Griffith Park Sunset Hike', 'hiking', 4, '17:00', 120, 'Griffith Park Fern Dell trailhead', null, 'Los Angeles', -118.3080, 34.1130, true, 0, null, 'Moderate 4 miles to the observatory. Headlamps for the way down.'),
  ('seed-10', 'Lakefront Long Run', 'running', 5, '07:00', 90, 'Lakefront Trail at Diversey', null, 'Chicago', -87.6330, 41.9320, false, 0, null, '10 to 14 miles, out and back. Water stop at mile 5.'),
  ('seed-11', 'Intro to Olympic Lifting', 'lifting', 6, '10:00', 90, 'West Loop Barbell Club', null, 'Chicago', -87.6500, 41.8820, true, 2000, 12, 'Snatch and clean basics with PVC, then light barbells.'),
  ('seed-12', 'Red Rocks Stair Workout', 'hiking', 2, '06:30', 60, 'Red Rocks Park Amphitheatre steps', null, 'Denver', -105.2050, 39.6650, false, 0, null, 'Stairs, push-ups, repeat. Bring water: it is 6,400 ft.'),
  ('seed-13', 'Cherry Creek Group Ride', 'cycling', 3, '18:00', 90, 'Cherry Creek Trail at Confluence Park', null, 'Denver', -105.0080, 39.7550, true, 0, null, 'No-drop 20 miles at a social pace. Helmets required.'),
  ('seed-14', 'South Beach Sunrise Swim', 'swimming', 4, '06:45', 45, 'Lummus Park beach (10th St)', null, 'Miami', -80.1300, 25.7800, false, 0, null, 'Open water, buoy to buoy. Strong swimmers; lifeguard on kayak.'),
  ('seed-15', 'Bayfront Dance Fitness', 'dance_fitness', 2, '19:00', 60, 'Bayfront Park Lawn', null, 'Miami', -80.1860, 25.7750, true, 0, null, 'High-energy, zero experience needed. Just move.'),
  ('seed-16', 'Green Lake Loop & Coffee', 'walking', 1, '08:00', 60, 'Green Lake Park bathhouse', null, 'Seattle', -122.3400, 47.6800, true, 0, null, 'Walk or jog the 2.8-mile loop at your pace, then coffee.'),
  ('seed-17', 'Boxing Fundamentals', 'boxing', 5, '18:30', 75, 'Capitol Hill Boxing Club', null, 'Seattle', -122.3200, 47.6200, true, 1800, 16, 'Stance, footwork, combos. Wraps and gloves available.'),
  ('seed-18', 'BeltLine Run Club', 'running', 3, '18:30', 60, 'Atlanta BeltLine Eastside Trail', 'Ponce City Market meetup', 'Atlanta', -84.3650, 33.7720, true, 0, null, '3 or 5 miles. All paces, social after.'),
  ('seed-19', 'Piedmont Park Pickleball Mixer', 'pickleball', 6, '10:00', 120, 'Piedmont Park courts', null, 'Atlanta', -84.3730, 33.7850, false, 500, 32, 'Intermediate round robin, 3.5+.')
)
insert into events (source, external_id, activity_id, title, description, starts_at, ends_at, venue_name, address,
                    city, state, location, beginner_friendly, cost_cents, capacity, moderation)
select 'seed', s.ext, a.id, s.title, s.descr,
       ((current_date + s.days) + s.start_t::time) at time zone tz.tz,
       ((current_date + s.days) + s.start_t::time) at time zone tz.tz + make_interval(mins => s.mins),
       s.venue, s.address, s.city, tz.state,
       format('SRID=4326;POINT(%s %s)', s.lng, s.lat)::extensions.geography,
       s.beginner, s.cost, s.cap, 'approved'
from seed s
join tz on tz.city = s.city
left join activities a on a.slug = s.slug
on conflict (source, external_id) do nothing;
