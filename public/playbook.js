export const PLAYBOOK = {
  stages: ["Just browsing", "Exploring options", "Evaluating us", "Ready to buy"],

  actions: {
    send_pricing: {
      title: "Share pricing",
      tips: {
        when: [
          { signal: "discusses_budget", text: "They mentioned budget — tie the price to the value they described." },
          { signal: "mentions_timeline", text: "They have a timeline. Include implementation time in the price discussion." },
        ],
        always: [
          "Walk them through the plan that matches what they described, then ask if it fits their budget.",
        ],
      },
    },
    book_demo: {
      title: "Book a demo",
      tips: {
        when: [
          { signal: "uses_ownership_language", text: "They’re already imagining using it — tailor the demo to their specific setup." },
        ],
        always: [
          "Offer two specific times and tailor the demo to the setup they mentioned.",
        ],
      },
    },
    loop_in_decision_maker: {
      title: "Bring in the approver",
      tips: {
        when: [
          { signal: "decision_maker_involved", max: 0.4, text: "The decision maker isn’t in the loop yet. Ask who signs off and offer a short call." },
        ],
        always: [
          "Ask who else needs to approve, and offer a short call with them this week.",
        ],
      },
    },
    handle_objection: {
      title: "Address the concern",
      tips: {
        when: [
          { signal: "has_blocking_objection", text: "There’s a blocking concern. Repeat it in their words, then answer it directly." },
        ],
        always: [
          "Repeat their concern back in their words, then answer it directly before moving on.",
        ],
      },
    },
    send_proposal: {
      title: "Send the proposal",
      tips: {
        when: [
          { signal: "discusses_budget", text: "Budget is confirmed — move straight to the formal quote." },
          { signal: "decision_maker_involved", text: "The approver is on board. Lock it in with a proposal." },
        ],
        always: [
          "They’re ready. Confirm the details and tell them when the quote or contract will arrive.",
        ],
      },
    },
    ask_discovery_question: {
      title: "Ask a discovery question",
      tips: {
        when: [],
        always: [
          "Find out what problem they’re solving and what happens if they don’t solve it.",
        ],
      },
    },
    nurture_follow_up: {
      title: "Set a follow-up",
      tips: {
        when: [],
        always: [
          "Agree on a date to check back and send something useful before then.",
        ],
      },
    },
    no_action: {
      title: "Keep listening",
      tips: { when: [], always: [] },
    },
  },

  priority: [
    "handle_objection",
    "send_proposal",
    "send_pricing",
    "book_demo",
    "loop_in_decision_maker",
    "ask_discovery_question",
    "nurture_follow_up",
    "no_action",
  ],

  rules: [
    {
      when: (signals) => (signals.has_blocking_objection ?? 0) >= 0.7,
      block: ["send_proposal"],
      note: "Address the objection before sending a proposal.",
    },
  ],

  listeningTips: [
    "Let them talk. The more they say, the clearer the next step becomes.",
    "Ask open-ended questions to draw out their needs.",
    "Listen for timeline, budget, and who else is involved.",
  ],
};
