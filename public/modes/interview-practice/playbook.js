export const PLAYBOOK = {
  stages: ["Hurts you", "Weak", "Solid", "Standout"],

  actions: {
    add_example: {
      title: "Give an example",
      tips: {
        when: [],
        always: [
          "Back it up with one short story: the situation, what you did, and what happened.",
        ],
      },
    },
    show_impact: {
      title: "Show the result",
      tips: {
        when: [
          { signal: "gives_example", text: "Good story. Now finish it: what changed because of you? A number helps." },
        ],
        always: [
          "End with the outcome: time saved, money made, a problem that stopped happening.",
        ],
      },
    },
    answer_the_question: {
      title: "Answer the question",
      tips: {
        when: [],
        always: [
          "Lead with a direct answer in the first sentence, then add the detail.",
        ],
      },
    },
    be_concise: {
      title: "Tighten it up",
      tips: {
        when: [
          { signal: "too_long", text: "Aim for about a minute. Cut the backstory and keep the part where you act." },
        ],
        always: [
          "Say your point, give one example, and stop. They'll ask if they want more.",
        ],
      },
    },
    own_it: {
      title: "Say what you did",
      tips: {
        when: [
          { signal: "owns_their_role", max: 0.4, text: "Swap some \"we\" for \"I\". They're hiring you, not your old team." },
        ],
        always: [
          "Make your own part clear: what you decided, built, or changed.",
        ],
      },
    },
    stay_positive: {
      title: "Keep it positive",
      tips: {
        when: [],
        always: [
          "Talk about what you're moving toward, not what you're getting away from.",
        ],
      },
    },
    connect_to_role: {
      title: "Connect it to this job",
      tips: {
        when: [],
        always: [
          "Add one line that ties your answer to this role, like \"That's the kind of work I'd do here.\"",
        ],
      },
    },
    strong_answer: {
      title: "Strong answer",
      tips: {
        when: [
          { signal: "shows_result", text: "Ending on a clear result makes it memorable." },
          { signal: "owns_their_role", text: "It's clear what you did yourself, which is exactly what they need to hear." },
        ],
        always: [
          "Direct, specific, and relevant. Keep answering like that.",
        ],
      },
    },
  },

  priority: [
    "stay_positive",
    "answer_the_question",
    "add_example",
    "own_it",
    "show_impact",
    "be_concise",
    "connect_to_role",
    "strong_answer",
  ],

  rules: [
    {
      when: (signals) => (signals.negative_tone ?? 0) >= 0.7,
      block: ["strong_answer"],
      note: "That came across negative about a past job, so fix that first.",
    },
  ],

  listeningTips: [
    "No single fix stands out. Try a more specific example with a clear result.",
  ],

  // Practice: each answer is scored on its own, so there's no smoothing between attempts
  config: { stageSmoothing: 1, stageHysteresis: 0, switchMargin: 0, confirmUpdates: 1 },

  copy: {
    stageKicker: "Your answer",
    idleStage: "Answer to see how it lands",
    other: "Interviewer",
    actionKicker: "Work on",
    listenTitle: "No single fix",
  },

  signals: {
    gives_example: { label: "Gives an example" },
    shows_result: { label: "Shows the result" },
    owns_their_role: { label: "Says what they did" },
    too_long: { label: "Runs long", warn: 0.6 },
    negative_tone: { label: "Negative about a past job", warn: 0.5, block: 0.7 },
  },

  // The interviewer asks each question in turn; you answer each one
  scenarios: [
    {
      title: "The opener",
      setup: "First round for a role you want. The interviewer is friendly and has your resume open.",
      lines: [
        "Thanks for coming in. So, tell me about yourself.",
        "What made you apply for this role?",
        "What would you say is your biggest strength?",
        "And what's a weakness you're working on?",
      ],
    },
    {
      title: "Behavioral questions",
      setup: "Second round with the hiring manager, who wants specifics.",
      lines: [
        "Tell me about a time you disagreed with a coworker. How did you handle it?",
        "Describe a project that didn't go as planned. What happened?",
        "Tell me about something from your last job you're proud of.",
      ],
    },
    {
      title: "The tough ones",
      setup: "Final round. The interviewer is probing for concerns.",
      lines: [
        "I see a gap in your resume. What happened there?",
        "Why are you leaving your current job?",
        "Honestly, you seem a little junior for this role. Why should we hire you?",
        "What are your salary expectations?",
      ],
    },
    {
      title: "Closing",
      setup: "The last few minutes of the interview.",
      lines: [
        "We're about out of time. Do you have any questions for me?",
        "Is there anything else you'd like us to know about you?",
      ],
    },
  ],
};
