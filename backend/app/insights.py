"""Deterministic 'AI-style' trade-review insights.

Analyzes a user's trades and surfaces actionable observations. Rule-based and
dependency-free (no external LLM), so it runs anywhere and is fully testable.
Each insight is a dict: {key, title, detail, sentiment, metric}.
sentiment ∈ {positive, negative, neutral}.
"""

from __future__ import annotations

from collections import defaultdict

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _fmt(v: float) -> str:
    sign = "-" if v < 0 else ""
    return f"{sign}${abs(v):,.2f}"


def _grouped_net(closed: list[dict], key_fn) -> dict[str, dict]:
    groups: dict[str, dict] = defaultdict(lambda: {"net": 0.0, "n": 0, "wins": 0})
    for t in closed:
        k = key_fn(t)
        if k is None:
            continue
        g = groups[k]
        g["net"] += t["net_pnl"]
        g["n"] += 1
        if t["net_pnl"] > 0:
            g["wins"] += 1
    return groups


def generate_insights(trades: list[dict], min_trades: int = 5) -> list[dict]:
    closed = [t for t in trades if t.get("status") == "closed" and t.get("net_pnl") is not None]
    insights: list[dict] = []

    if len(closed) < min_trades:
        return [
            {
                "key": "not_enough_data",
                "title": "Keep logging trades",
                "detail": f"You have {len(closed)} closed trades. Insights sharpen once you log "
                f"at least {min_trades}.",
                "sentiment": "neutral",
                "metric": None,
            }
        ]

    closed.sort(key=lambda t: t.get("exit_date") or t.get("entry_date"))
    total_net = sum(t["net_pnl"] for t in closed)
    wins = [t for t in closed if t["net_pnl"] > 0]
    losses = [t for t in closed if t["net_pnl"] < 0]
    win_rate = len(wins) / len(closed) * 100

    # --- Weekday edge ---
    by_day = _grouped_net(closed, lambda t: WEEKDAYS[(t["exit_date"] or t["entry_date"]).weekday()])
    if by_day:
        best = max(by_day.items(), key=lambda kv: kv[1]["net"])
        worst = min(by_day.items(), key=lambda kv: kv[1]["net"])
        if best[1]["net"] > 0:
            insights.append({
                "key": "best_weekday",
                "title": f"{best[0]} is your strongest day",
                "detail": f"{_fmt(best[1]['net'])} across {best[1]['n']} trades. Lean into it.",
                "sentiment": "positive",
                "metric": best[1]["net"],
            })
        if worst[1]["net"] < 0 and worst[0] != best[0]:
            insights.append({
                "key": "worst_weekday",
                "title": f"{worst[0]} is costing you",
                "detail": f"{_fmt(worst[1]['net'])} across {worst[1]['n']} trades. Consider trading "
                f"smaller or sitting out.",
                "sentiment": "negative",
                "metric": worst[1]["net"],
            })

    # --- Setup / playbook edge ---
    by_setup = _grouped_net([t for t in closed if t.get("setup")], lambda t: t["setup"])
    strong = {k: v for k, v in by_setup.items() if v["n"] >= 3}
    if strong:
        best_setup = max(strong.items(), key=lambda kv: kv[1]["net"])
        worst_setup = min(strong.items(), key=lambda kv: kv[1]["net"])
        if best_setup[1]["net"] > 0:
            wr = best_setup[1]["wins"] / best_setup[1]["n"] * 100
            insights.append({
                "key": "best_setup",
                "title": f"'{best_setup[0]}' is your edge",
                "detail": f"{_fmt(best_setup[1]['net'])} at {wr:.0f}% win rate over "
                f"{best_setup[1]['n']} trades.",
                "sentiment": "positive",
                "metric": best_setup[1]["net"],
            })
        if worst_setup[1]["net"] < 0 and worst_setup[0] != best_setup[0]:
            insights.append({
                "key": "worst_setup",
                "title": f"'{worst_setup[0]}' isn't working",
                "detail": f"{_fmt(worst_setup[1]['net'])} over {worst_setup[1]['n']} trades. "
                f"Refine the rules or drop it.",
                "sentiment": "negative",
                "metric": worst_setup[1]["net"],
            })

    # --- Long vs short skew ---
    by_dir = _grouped_net(closed, lambda t: t["direction"])
    if "long" in by_dir and "short" in by_dir and by_dir["long"]["n"] >= 3 and by_dir["short"]["n"] >= 3:
        lnet, snet = by_dir["long"]["net"], by_dir["short"]["net"]
        if lnet > 0 > snet:
            insights.append({
                "key": "direction_skew",
                "title": "You trade the long side far better",
                "detail": f"Longs {_fmt(lnet)} vs shorts {_fmt(snet)}. Your shorts are a leak.",
                "sentiment": "negative",
                "metric": snet,
            })
        elif snet > 0 > lnet:
            insights.append({
                "key": "direction_skew",
                "title": "You trade the short side far better",
                "detail": f"Shorts {_fmt(snet)} vs longs {_fmt(lnet)}. Reconsider your longs.",
                "sentiment": "negative",
                "metric": lnet,
            })

    # --- Revenge trading: performance right after a loss ---
    after_loss = []
    for prev, cur in zip(closed, closed[1:]):
        if prev["net_pnl"] < 0:
            after_loss.append(cur["net_pnl"])
    if len(after_loss) >= 4:
        avg_after = sum(after_loss) / len(after_loss)
        overall_avg = total_net / len(closed)
        if avg_after < 0 and avg_after < overall_avg:
            insights.append({
                "key": "revenge_trading",
                "title": "Your trades after a loss underperform",
                "detail": f"Average {_fmt(avg_after)} on the trade right after a loser "
                f"(vs {_fmt(overall_avg)} overall). Watch for revenge trades.",
                "sentiment": "negative",
                "metric": avg_after,
            })

    # --- Mistakes cost ---
    mistake_trades = [t for t in closed if (t.get("mistakes") or "").strip()]
    if len(mistake_trades) >= 3:
        mnet = sum(t["net_pnl"] for t in mistake_trades)
        if mnet < 0:
            insights.append({
                "key": "mistakes_cost",
                "title": "Tagged mistakes are expensive",
                "detail": f"Trades where you flagged a mistake total {_fmt(mnet)} across "
                f"{len(mistake_trades)} trades. Fixing these is your fastest gain.",
                "sentiment": "negative",
                "metric": mnet,
            })

    # --- Rating honesty: do high-rated trades actually win? ---
    rated = [t for t in closed if t.get("rating")]
    if len(rated) >= 6:
        high = [t for t in rated if t["rating"] >= 4]
        low = [t for t in rated if t["rating"] <= 2]
        if len(high) >= 3 and len(low) >= 3:
            hi_avg = sum(t["net_pnl"] for t in high) / len(high)
            lo_avg = sum(t["net_pnl"] for t in low) / len(low)
            if hi_avg > lo_avg:
                insights.append({
                    "key": "rating_calibrated",
                    "title": "Your trade grading is well calibrated",
                    "detail": f"A-grade trades average {_fmt(hi_avg)} vs {_fmt(lo_avg)} for low-rated. "
                    f"Trust your process — take more A setups.",
                    "sentiment": "positive",
                    "metric": hi_avg,
                })
            else:
                insights.append({
                    "key": "rating_miscalibrated",
                    "title": "Your self-rating doesn't match results",
                    "detail": f"High-rated trades average {_fmt(hi_avg)} vs {_fmt(lo_avg)} for low-rated. "
                    f"Revisit what you consider an A setup.",
                    "sentiment": "neutral",
                    "metric": hi_avg,
                })

    # --- Win rate / expectancy framing ---
    expectancy = total_net / len(closed)
    if expectancy > 0:
        insights.append({
            "key": "expectancy",
            "title": "You have a positive expectancy",
            "detail": f"{_fmt(expectancy)} per trade at {win_rate:.0f}% win rate. Consistency and "
            f"size are your levers now.",
            "sentiment": "positive",
            "metric": expectancy,
        })
    else:
        insights.append({
            "key": "expectancy",
            "title": "Expectancy is negative right now",
            "detail": f"{_fmt(expectancy)} per trade. Focus on cutting losers and your worst "
            f"setups before adding size.",
            "sentiment": "negative",
            "metric": expectancy,
        })

    # --- Average win vs loss ---
    if wins and losses:
        avg_win = sum(t["net_pnl"] for t in wins) / len(wins)
        avg_loss = abs(sum(t["net_pnl"] for t in losses) / len(losses))
        if avg_loss > avg_win and win_rate < 55:
            insights.append({
                "key": "risk_reward",
                "title": "Your losers are bigger than your winners",
                "detail": f"Avg win {_fmt(avg_win)} vs avg loss {_fmt(-avg_loss)}. Tighten stops or "
                f"let winners run to fix your risk:reward.",
                "sentiment": "negative",
                "metric": avg_win - avg_loss,
            })

    return insights
