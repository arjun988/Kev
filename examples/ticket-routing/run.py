"""Ticket routing with the Python SDK. Requires a running Kev server."""

from kev import Choice, KevClient, Noul, Score


def main() -> None:
    client = KevClient()
    res = client.system_one(
        state=(
            "Hi, I've been charged twice for order #18422 and nobody has "
            "replied in 3 days. I want a refund NOW or I will cancel."
        ),
        questions={
            "topic": Choice(
                "Which team should handle this support ticket?",
                {
                    "billing": "Charges, refunds, invoices, payments",
                    "shipping": "Delivery delays, lost packages, tracking",
                    "technical": "Bugs, outages, product not working",
                },
            ),
            "severity": Score(
                "How urgent is this ticket?",
                [
                    "can wait several days",
                    "handle this week",
                    "handle today",
                    "customer about to churn — act now",
                ],
            ),
            "escalate": Noul("Should this be escalated to a human agent immediately?"),
        },
        trace=True,
    )
    print(res.model_dump_json(indent=2))
    topic = res.answers["topic"]
    if topic.type == "choice":
        print(f"\nRoute → {topic.choice} (confidence {topic.confidence:.2f})")


if __name__ == "__main__":
    main()
