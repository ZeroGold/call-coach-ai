export const PLAYBOOK = {
  stages: ["Upset", "Frustrated", "Calm", "Satisfied"],

  actions: {
    acknowledge_feelings: {
      title: "Acknowledge how they feel",
      tips: {
        when: [
          { signal: "repeat_contact", text: "They've been through this before. Say so: “I'm sorry you've had to call about this again.”" },
          { signal: "time_pressure", text: "Show you heard the deadline, and that you'll work to it." },
        ],
        always: [
          "Name the feeling and apologize for the trouble before you start fixing anything.",
        ],
      },
    },
    ask_clarifying_question: {
      title: "Ask a clarifying question",
      tips: {
        when: [],
        always: [
          "Ask what they expected to happen and what happened instead.",
        ],
      },
    },
    verify_details: {
      title: "Get the details you need",
      tips: {
        when: [
          { signal: "strong_emotion", text: "Tell them why you need it: “So I can pull up your order and fix this.”" },
        ],
        always: [
          "Ask for one detail at a time, and read it back to confirm.",
        ],
      },
    },
    explain_solution: {
      title: "Explain the fix",
      tips: {
        when: [
          { signal: "time_pressure", text: "Lead with how fast it will be sorted, then walk through the steps." },
        ],
        always: [
          "Say what you're going to do in plain words, then check it works for them.",
        ],
      },
    },
    set_expectations: {
      title: "Set expectations",
      tips: {
        when: [
          { signal: "repeat_contact", text: "Give them a reference number and a date, so they won't need to chase it again." },
        ],
        always: [
          "Tell them what happens next, when, and whether they need to do anything.",
        ],
      },
    },
    escalate: {
      title: "Escalate",
      tips: {
        when: [
          { signal: "asks_for_supervisor", text: "They asked for a supervisor. Don't argue; offer the handoff and summarize the issue for them." },
        ],
        always: [
          "Explain who you're passing them to and why, so they don't have to repeat themselves.",
        ],
      },
    },
    confirm_resolution: {
      title: "Confirm it's resolved",
      tips: {
        when: [
          { signal: "issue_resolved", text: "Sounds sorted. Ask if there's anything else, then close warmly." },
        ],
        always: [
          "Check it fully solves their problem before you wrap up.",
        ],
      },
    },
    no_action: {
      title: "Keep listening",
      tips: { when: [], always: [] },
    },
  },

  priority: [
    "escalate",
    "acknowledge_feelings",
    "verify_details",
    "ask_clarifying_question",
    "explain_solution",
    "set_expectations",
    "confirm_resolution",
    "no_action",
  ],

  rules: [
    {
      when: (signals) => (signals.strong_emotion ?? 0) >= 0.7,
      block: ["explain_solution", "confirm_resolution"],
      note: "They're upset. Acknowledge that before moving to the fix.",
    },
    {
      when: (signals) => (signals.wants_to_cancel ?? 0) >= 0.7,
      block: ["confirm_resolution"],
      note: "They mentioned cancelling. Don't close out until that's addressed.",
    },
  ],

  listeningTips: [
    "Let them explain the whole problem before you jump in.",
    "Listen for what they've already tried and how long it's been going on.",
  ],

  copy: {
    stageKicker: "Caller mood",
    idleStage: "Waiting for the caller",
    other: "Caller",
    otherSpeaking: "Caller speaking",
    typeOther: "Type what the caller said",
    idleTip: "Press Start listening, or type what the caller says below. Press S to switch who's speaking.",
  },

  signals: {
    repeat_contact: { label: "Called before" },
    time_pressure: { label: "Urgent" },
    strong_emotion: { label: "Strong emotion", warn: 0.6, block: 0.8 },
    wants_to_cancel: { label: "Wants to cancel", warn: 0.5, block: 0.7 },
    asks_for_supervisor: { label: "Asked for supervisor", warn: 0.5 },
    issue_resolved: { label: "Issue resolved" },
  },

  sample: [
    ["customer", "Hi, I'm calling because my internet has been dropping out every evening for a week."],
    ["customer", "This is the third time I've called. Every time someone says it'll be fixed and it never is."],
    ["rep", "I'm really sorry, that sounds exhausting. Let's get it sorted properly this time."],
    ["customer", "Thanks. I work from home, so I really need it working by Monday."],
    ["rep", "Can I get the account number or the address on the account?"],
    ["customer", "Sure, it's 42 Maple Street."],
    ["rep", "I can see the line fault. I'll book a technician for Saturday morning and send you a reference number."],
    ["customer", "Saturday works. Thank you, that's a relief."],
  ],
};
