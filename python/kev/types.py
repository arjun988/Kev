from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel


class ChoiceQuestion(BaseModel):
    type: Literal["choice"] = "choice"
    instructions: str
    criteria: dict[str, str | None]


class ScoreQuestion(BaseModel):
    type: Literal["score"] = "score"
    instructions: str
    criteria: list[str]


class NoulQuestion(BaseModel):
    type: Literal["noul"] = "noul"
    instructions: str
    criteria: dict[str, str] | None = None


Question = ChoiceQuestion | ScoreQuestion | NoulQuestion


def Choice(instructions: str, criteria: dict[str, str | None]) -> ChoiceQuestion:
    return ChoiceQuestion(instructions=instructions, criteria=criteria)


def Score(instructions: str, criteria: list[str]) -> ScoreQuestion:
    return ScoreQuestion(instructions=instructions, criteria=criteria)


def Noul(
    instructions: str,
    criteria: dict[str, str] | None = None,
) -> NoulQuestion:
    return NoulQuestion(instructions=instructions, criteria=criteria)


class ChoiceAnswer(BaseModel):
    type: Literal["choice"]
    choice: str
    confidence: float
    probabilities: dict[str, float]


class ScoreAnswer(BaseModel):
    type: Literal["score"]
    score: float
    confidence: float
    legend: dict[str, str]
    probabilities: dict[str, float]


class NoulAnswer(BaseModel):
    type: Literal["noul"]
    noul: float


Answer = ChoiceAnswer | ScoreAnswer | NoulAnswer


class Usage(BaseModel):
    input_tokens: int
    output_tokens: int
    latency_ms: float | None = None


class SystemOneResponse(BaseModel):
    model: str
    answers: dict[str, Answer]
    usage: Usage
    trace: dict[str, Any] | None = None
