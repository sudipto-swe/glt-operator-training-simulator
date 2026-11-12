/**
 * Training Pack: SOPs, one-point lessons (OPLs) and quiz bank.
 * One data source rendered by the Training Pack screen, printable to PDF
 * via the browser's print dialog, and quiz results gate Assess mode.
 */

export interface PackDoc {
  id: string;
  type: 'SOP' | 'OPL';
  title: string;
  purpose: string;
  steps: string[];
  warnings: string[];
  related: string[];
}

export const PACK_DOCS: PackDoc[] = [
  {
    id: 'SOP-01',
    type: 'SOP',
    title: 'Line Cold Start',
    purpose:
      'Bring the GLT line from a cold stop to stable production without quality loss or equipment stress.',
    steps: [
      'Walk the line: confirm all guards closed, no tools or personnel inside equipment.',
      'Verify e-stop reset (twist-release) and no active LOTO locks.',
      'Press LINE START - the 20-second purge and warm-up sequence runs.',
      'Open conditioner steam; set outlet moisture setpoint to 19%.',
      'Start the thresher at 950 rpm and the air separator at 20 m/s.',
      'Start the dryer at 85 degC and let the outlet trend settle below 95 degC.',
      'Enable feed and ramp to 4000 kg/h; watch hopper level and thresher load.',
      'Confirm packed moisture inside 11.5-13.5% before starting packing.',
      'Acknowledge all start-up alarms and log the run.'
    ],
    warnings: [
      'Never start the line with an active CRITICAL alarm.',
      'Dryer must be started before leaf reaches it - hot surface contact with wet leaf at standstill bakes product.'
    ],
    related: ['S1']
  },
  {
    id: 'SOP-02',
    type: 'SOP',
    title: 'Normal Shutdown',
    purpose: 'Stop the line clean: empty the in-process material and leave equipment safe.',
    steps: [
      'Stop packing and complete the current case.',
      'Ramp feed down to minimum, then disable feed.',
      'Let the line run until the hopper falls below 30%.',
      'Close conditioner steam.',
      'Stop thresher and air separator.',
      'Run the dryer down to 60 degC, then stop it.',
      'Press LINE STOP. Acknowledge all remaining alarms and file the shift log.'
    ],
    warnings: [
      'Do not e-stop for routine shutdowns - wet leaf left in the dryer will degrade.',
      'Confirm no active LOTO before planning maintenance during shutdown.'
    ],
    related: ['S1']
  },
  {
    id: 'SOP-03',
    type: 'SOP',
    title: 'Jam Clearing Under LOTO',
    purpose: 'Clear a feed conveyor jam without exposing anyone to stored energy.',
    steps: [
      'Acknowledge the FEED_JAM alarm and stop the feed.',
      'Execute a normal line stop.',
      'Isolate all energy sources: electrical main, steam header, instrument air.',
      'Apply your personal lock and danger tag.',
      'Verify zero energy: attempt a start at the local panel, confirm steam bled and air vented.',
      'Open the guard, remove the foreign object, inspect the belt and skirting.',
      'Close the guard, remove your lock, restore energy.',
      'Restart the line and resume feed gradually.'
    ],
    warnings: [
      'Reaching into equipment without a VERIFIED zero-energy state is a critical violation and ends the exercise.',
      'One lock per person: every person working adds their own lock.'
    ],
    related: ['S2']
  },
  {
    id: 'SOP-04',
    type: 'SOP',
    title: 'NTRM Contamination Response',
    purpose: 'Contain non-tobacco related material before it reaches packed product.',
    steps: [
      'Acknowledge the NTRM_HIGH alarm and check the trend.',
      'Stop the feed - the sorting crew never works a running intake.',
      'Mobilise the sorting crew (SORT INTAKE action, about 45 seconds).',
      'Wait for NTRM to fall below 1500 ppm before resuming.',
      'Resume feed and hold the trend below 1200 ppm for 30 seconds.',
      'Quarantine cases packed during the excursion per quality hold procedure.'
    ],
    warnings: [
      'Do not resume feed while NTRM is above the acceptance limit.',
      'Cases packed during the spike must be flagged in the records.'
    ],
    related: ['S4']
  },
  {
    id: 'SOP-05',
    type: 'SOP',
    title: 'Dryer Over-Temperature Emergency',
    purpose: 'Kill a runaway dryer before it becomes a fire.',
    steps: [
      'Acknowledge DRYER_TEMP_HIGH immediately.',
      'If temperature keeps climbing: EMERGENCY STOP. Do not chase the setpoint.',
      'Twist-release the e-stop once the guard is confirmed closed.',
      'Full LOTO: isolate, lock, verify zero energy.',
      'Repair the heater (contactor replacement) in VERIFIED state.',
      'Remove locks, restart, and confirm the dryer settles at 75-95 degC.'
    ],
    warnings: [
      'E-stop must be actuated within 45 seconds of the CRITICAL alarm.',
      'At 130 degC the product is a fire risk - the exercise auto-fails.'
    ],
    related: ['S5']
  },
  {
    id: 'OPL-01',
    type: 'OPL',
    title: 'Air Separator Tuning in 60 Seconds',
    purpose: 'Set air velocity for the lamina/stem split without filling either stream with the wrong material.',
    steps: [
      'Start at 20 m/s - the design sweet spot.',
      'Stem in lamina above 4%? Raise velocity 1 m/s and re-check after 30 seconds.',
      'Lamina appearing in the stem reject? Lower velocity 1 m/s.',
      'Wet leaf (outlet above 21%) sticks to stem: fix moisture before tuning air.'
    ],
    warnings: ['Change one thing at a time and let the trend settle before judging.'],
    related: ['S1']
  },
  {
    id: 'OPL-02',
    type: 'OPL',
    title: 'Reading the Dryer Temperature Profile',
    purpose: 'Know what the dryer temperature is telling you before it becomes an alarm.',
    steps: [
      'Normal band: 75-95 degC at 85 degC setpoint.',
      'Slow rise with steady setpoint: suspect the heater loop or sensor.',
      'Fast rise beyond setpoint: heater fault - this is your e-stop cue.',
      'Temperature sag: feed surged wet - check conditioning first.'
    ],
    warnings: ['Never cancel a dryer temperature alarm without eyes on the trend.'],
    related: ['S5']
  },
  {
    id: 'OPL-03',
    type: 'OPL',
    title: 'Trust, Then Verify: Moisture Sensors',
    purpose: 'Every operator rule about the inline analyser.',
    steps: [
      'The display is a sensor, not the truth: self-check failures are your friend.',
      'Lab sample beats display - take one whenever numbers feel wrong.',
      'Display fine but packed moisture drifting? Switch to the reference analyser.',
      'Recalibrate the inline unit only with the line stopped.'
    ],
    warnings: ['Never compensate a suspect sensor with setpoint changes - you hide the fault and ship bad product.'],
    related: ['S6']
  }
];

/* ------------------------------------------------------------------ */
/* Quiz bank                                                           */
/* ------------------------------------------------------------------ */

export interface QuizQuestion {
  id: string;
  q: string;
  options: string[];
  answer: number;
  explain: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  passPct: number;
  questions: QuizQuestion[];
}

export const QUIZZES: Quiz[] = [
  {
    id: 'quiz-safety',
    title: 'Safety & LOTO',
    description: 'Lockout-tagout, e-stops, guards and emergency response. Required for S2 and S5.',
    passPct: 80,
    questions: [
      {
        id: 'q-los-1',
        q: 'What is the correct LOTO sequence?',
        options: [
          'Lock -> isolate -> verify -> work',
          'Isolate -> lock -> verify zero energy -> work',
          'Verify -> isolate -> lock -> work',
          'Isolate -> verify -> lock -> work'
        ],
        answer: 1,
        explain: 'Isolate all energy sources, apply your personal lock, then verify zero energy before work.'
      },
      {
        id: 'q-los-2',
        q: 'When may you reach into the feed conveyor to clear a jam?',
        options: [
          'After the line stops moving',
          'After the e-stop is pressed',
          'Only after LOTO reaches VERIFIED zero-energy state',
          'Whenever the guard is open'
        ],
        answer: 2,
        explain: 'Only a verified zero-energy state makes body-in-equipment work legal. E-stops can be reset.'
      },
      {
        id: 'q-los-3',
        q: 'The dryer temperature passes 115 degC (CRITICAL). What is the correct response?',
        options: [
          'Lower the setpoint and watch',
          'Actuate the emergency stop',
          'Increase air velocity through the dryer',
          'Acknowledge the alarm and continue'
        ],
        answer: 1,
        explain: 'A runaway dryer is a fire risk. E-stop immediately - do not chase the setpoint.'
      },
      {
        id: 'q-los-4',
        q: 'You open a guard while the line is running. What happens?',
        options: [
          'Nothing, guards are advisory',
          'The line auto-stops via interlock and it counts as a safety violation',
          'Only an alarm appears',
          'The line continues; you get a warning at shift end'
        ],
        answer: 1,
        explain: 'The guard interlock stops the line; opening it while running is a scored safety violation.'
      },
      {
        id: 'q-los-5',
        q: 'A critical alarm has been active and unacknowledged for a minute. This is:',
        options: [
          'Acceptable if you are busy',
          'A scored safety deduction - critical alarms need immediate acknowledgement',
          'Fine, acknowledgement is optional',
          'Only an issue at shift handover'
        ],
        answer: 1,
        explain: 'Unacknowledged critical alarms are scored: acknowledgement is how you take ownership of an event.'
      },
      {
        id: 'q-los-6',
        q: 'Zero-energy verification includes:',
        options: [
          'Looking at the breaker panel from a distance',
          'Attempting a start at the local panel plus confirming steam bled and air vented',
          'Asking the control room if power is off',
          'Checking that the motor is quiet'
        ],
        answer: 1,
        explain: 'Try-start at the local panel and physically confirm stored energy (steam, air) is released.'
      },
      {
        id: 'q-los-7',
        q: 'After repairing the dryer heater you should:',
        options: [
          'Restart immediately to save time',
          'Remove your lock, restore energy, then restart and confirm temperature settles 75-95 degC',
          'Leave the lock on for the next shift',
          'Bypass the alarm system for a faster restart'
        ],
        answer: 1,
        explain: 'Locks off, energy restored, restart, then verify the dryer settles in the safe band.'
      },
      {
        id: 'q-los-8',
        q: 'When is an e-stop the RIGHT choice (vs a normal stop)?',
        options: [
          'Any alarm appears',
          'Personnel or equipment are in danger, or a fault is escalating to fire risk',
          'At every shift end',
          'When the feed rate is too high'
        ],
        answer: 1,
        explain: 'E-stop is for danger and escalating emergencies; process faults get a controlled normal stop.'
      }
    ]
  },
  {
    id: 'quiz-process',
    title: 'Process Fundamentals',
    description: 'GLT line stations, startup order and conditioning. Required for S1 and S3.',
    passPct: 80,
    questions: [
      {
        id: 'q-prc-1',
        q: 'Correct cold-start order of the stations?',
        options: [
          'Feed -> thresher -> dryer -> steam -> packing',
          'Steam -> thresher & air separator -> dryer -> feed -> packing',
          'Dryer -> feed -> steam -> thresher -> packing',
          'Packing -> feed -> steam -> thresher -> dryer'
        ],
        answer: 1,
        explain: 'Conditioning first (leaf needs threshing moisture), then threshing/air separation, dryer hot, then feed.'
      },
      {
        id: 'q-prc-2',
        q: 'The blend hopper exists to:',
        options: [
          'Add moisture to the leaf',
          'Buffer and blend intake lots into a consistent feed',
          'Cool the leaf before threshing',
          'Filter NTRM from the leaf'
        ],
        answer: 1,
        explain: 'The blend hopper decouples intake tips from the line and evens out the leaf mix.'
      },
      {
        id: 'q-prc-3',
        q: 'Conditioner outlet moisture target for threshing is about:',
        options: ['12%', '19%', '24%', '9%'],
        answer: 1,
        explain: 'Around 19% - dry leaf shatters, soaked leaf will not separate cleanly from stem.'
      },
      {
        id: 'q-prc-4',
        q: 'The air separator splits lamina from stem using:',
        options: [
          'Screen mesh size',
          'Air velocity - light lamina lifts, heavy stem drops',
          'Water flotation',
          'Magnetic attraction'
        ],
        answer: 1,
        explain: 'Adjustable air velocity carries lamina up while stem falls through - around 20 m/s is nominal.'
      },
      {
        id: 'q-prc-5',
        q: 'Packed product moisture specification is:',
        options: ['8.5-10%', '11.5-13.5%', '16-18%', '19-21%'],
        answer: 1,
        explain: '11.5-13.5% at packing - the dryer removes what conditioning added, plus a margin.'
      },
      {
        id: 'q-prc-6',
        q: 'Outlet moisture keeps climbing although the setpoint is fixed. First suspect:',
        options: [
          'The dryer fan',
          'The steam/water valve (stuck open) or the moisture sensor',
          'The packing scale',
          'The thresher speed'
        ],
        answer: 1,
        explain: 'A growing setpoint-vs-trend gap with a fixed SP points to the valve or a lying sensor.'
      },
      {
        id: 'q-prc-7',
        q: 'Wet leaf (above 21%) reaching the thresher causes:',
        options: [
          'Better lamina yield',
          'Higher motor load and stem sticking (more stem in lamina)',
          'Lower NTRM',
          'Nothing measurable'
        ],
        answer: 1,
        explain: 'Wet leaf is heavy and sticky: motor current rises and separation quality falls.'
      },
      {
        id: 'q-prc-8',
        q: 'During shutdown, why run the dryer down before stopping it?',
        options: [
          'To save energy',
          'So residual heat does not bake the leaf left inside',
          'To calibrate the sensor',
          'To clean the cage'
        ],
        answer: 1,
        explain: 'Hot surfaces + stationary wet leaf = degraded product. Cool down first.'
      }
    ]
  },
  {
    id: 'quiz-quality',
    title: 'Quality & Response',
    description: 'NTRM, moisture verification and contamination control. Required for S4 and S6.',
    passPct: 80,
    questions: [
      {
        id: 'q-qua-1',
        q: 'NTRM stands for:',
        options: [
          'New Tobacco Refining Method',
          'Non-Tobacco Related Materials',
          'Net Threshing Residual Moisture',
          'Nominal Transfer Rate Modifier'
        ],
        answer: 1,
        explain: 'Non-Tobacco Related Materials: plastic, string, metal and other foreign matter in the leaf.'
      },
      {
        id: 'q-qua-2',
        q: 'NTRM spikes above 1500 ppm. First action?',
        options: [
          'Increase feed to dilute it',
          'Stop the feed, then sort at intake',
          'Raise the dryer temperature',
          'Ignore it - packing will catch it'
        ],
        answer: 1,
        explain: 'Stop the feed so the sorting crew can work safely, then remove the contaminated pallets.'
      },
      {
        id: 'q-qua-3',
        q: 'The inline moisture display reads 19.0% but the lab sample says 22.5%. You should:',
        options: [
          'Raise the setpoint to 22%',
          'Switch control to the reference analyser and treat the inline unit as suspect',
          'Lower the setpoint to 16%',
          'Trust the inline display - it is newer'
        ],
        answer: 1,
        explain: 'Lab beats display. Control on the reference and investigate the drifting sensor.'
      },
      {
        id: 'q-qua-4',
        q: 'Stem content in lamina above the 4% spec means:',
        options: [
          'Air velocity likely needs adjustment, or leaf is too wet',
          'Feed rate is too low',
          'The dryer is too cold',
          'Packing is misaligned'
        ],
        answer: 0,
        explain: 'Separation quality: tune air velocity and check conditioning moisture.'
      },
      {
        id: 'q-qua-5',
        q: 'Cases packed while product is out of spec must be:',
        options: [
          'Shipped - the customer will not notice',
          'Flagged and quarantined per the quality hold procedure',
          'Repacked into new cases',
          'Mixed into the next lot'
        ],
        answer: 1,
        explain: 'Out-of-spec production goes on quality hold and is documented.'
      },
      {
        id: 'q-qua-6',
        q: 'When may the analyser be recalibrated?',
        options: [
          'Any time, even while running',
          'With the line stopped (instrument work)',
          'Only during the annual shutdown',
          'Never - it is factory-sealed'
        ],
        answer: 1,
        explain: 'Calibration is instrument work: line stopped, per SOP.'
      },
      {
        id: 'q-qua-7',
        q: 'Compensating a drifting sensor by changing the moisture setpoint is:',
        options: [
          'Best practice',
          'Wrong - it hides the fault while real moisture goes out of spec',
          'Required every shift',
          'Fine if the shift is nearly over'
        ],
        answer: 1,
        explain: 'You would ship the exact defect you are hiding. Verify sensors, then fix them.'
      },
      {
        id: 'q-qua-8',
        q: 'The response-time component of your score measures:',
        options: [
          'How fast the line runs',
          'Time from alarm to the correct action on key steps',
          'Total exercise duration',
          'How quickly you restart after LOTO'
        ],
        answer: 1,
        explain: 'Key steps carry response targets (e.g. acknowledge within 30 s, e-stop within 45 s).'
      }
    ]
  }
];

export function quizById(id: string): Quiz | undefined {
  return QUIZZES.find((q) => q.id === id);
}
