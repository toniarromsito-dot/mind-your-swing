import { describe, expect, it } from "vitest";
import {
  computeBestBallStandings,
  computeChallengeTally,
  computeMatchPlayStandings,
  computePointsStandings,
  computeStrokeStandings,
  computeTeamStrokeStandings,
  type StandingsHoleScore,
  type StandingsPlayer,
} from "./standings";

const antonio: StandingsPlayer = { playerId: "p1", name: "Antonio", team: "A" };
const juan: StandingsPlayer = { playerId: "p2", name: "Juan", team: "A" };
const pablo: StandingsPlayer = { playerId: "p3", name: "Pablo", team: "B" };
const miguel: StandingsPlayer = { playerId: "p4", name: "Miguel", team: "B" };

function hole(number: number, par: number, playerId: string, strokes: number | null): StandingsHoleScore {
  return { holeNumber: number, par, playerId, strokes };
}

describe("computeStrokeStandings", () => {
  it("sorts players by lowest total strokes", () => {
    const scores = [hole(1, 4, antonio.playerId, 4), hole(1, 4, juan.playerId, 6)];
    const result = computeStrokeStandings([antonio, juan], scores);
    expect(result[0].playerId).toBe(antonio.playerId);
    expect(result[0].total).toBe(4);
    expect(result[1].total).toBe(6);
  });

  it("ignores holes without a recorded score", () => {
    const scores = [hole(1, 4, antonio.playerId, 4), hole(2, 4, antonio.playerId, null)];
    const result = computeStrokeStandings([antonio], scores);
    expect(result[0].total).toBe(4);
    expect(result[0].holesPlayed).toBe(1);
  });
});

describe("computeMatchPlayStandings", () => {
  it("reports the leader as N UP when they win more holes", () => {
    const scores = [
      hole(1, 4, antonio.playerId, 4),
      hole(1, 4, juan.playerId, 4),
      hole(2, 4, antonio.playerId, 4),
      hole(2, 4, juan.playerId, 4),
      hole(3, 3, antonio.playerId, 5),
      hole(3, 3, juan.playerId, 3),
    ];
    const result = computeMatchPlayStandings([antonio, juan], scores, 18);
    expect(result.leaderPlayerId).toBe(juan.playerId);
    expect(result.holesUp).toBe(1);
    expect(result.summary).toBe("Juan 1 UP");
  });

  it("reports AS (all square) when tied", () => {
    const scores = [hole(1, 4, antonio.playerId, 4), hole(1, 4, juan.playerId, 4)];
    const result = computeMatchPlayStandings([antonio, juan], scores, 18);
    expect(result.leaderPlayerId).toBeNull();
    expect(result.summary).toBe("AS");
  });

  it("only counts holes both players out counted", () => {
    const scores = [hole(1, 4, antonio.playerId, 4)]; // juan hasn't played hole 1 yet
    const result = computeMatchPlayStandings([antonio, juan], scores, 18);
    expect(result.holesRemaining).toBe(18);
  });
});

describe("computePointsStandings", () => {
  it("awards more points for better scores relative to par", () => {
    const scores = [
      hole(1, 4, antonio.playerId, 3), // birdie = 3pts
      hole(1, 4, juan.playerId, 6), // triple bogey = 0pts
    ];
    const result = computePointsStandings([antonio, juan], scores);
    expect(result[0].playerId).toBe(antonio.playerId);
    expect(result[0].points).toBe(3);
    expect(result[1].points).toBe(0);
  });
});

describe("computeTeamStrokeStandings", () => {
  it("sums both teammates' strokes per team", () => {
    const scores = [
      hole(1, 4, antonio.playerId, 4),
      hole(1, 4, juan.playerId, 5),
      hole(1, 4, pablo.playerId, 4),
      hole(1, 4, miguel.playerId, 4),
    ];
    const result = computeTeamStrokeStandings([antonio, juan, pablo, miguel], scores);
    const teamA = result.find((t) => t.team === "A")!;
    const teamB = result.find((t) => t.team === "B")!;
    expect(teamA.total).toBe(9);
    expect(teamB.total).toBe(8);
  });
});

describe("computeBestBallStandings", () => {
  it("takes the lower of the two teammates' scores per hole", () => {
    const scores = [
      hole(1, 4, antonio.playerId, 6),
      hole(1, 4, juan.playerId, 3),
      hole(2, 5, antonio.playerId, 5),
      hole(2, 5, juan.playerId, 7),
    ];
    const result = computeBestBallStandings([antonio, juan], scores);
    const teamA = result.find((t) => t.team === "A")!;
    // hole 1 best = 3, hole 2 best = 5 -> total 8
    expect(teamA.total).toBe(8);
  });
});

describe("computeChallengeTally", () => {
  it("counts wins per player", () => {
    const wins = [
      { playerId: antonio.playerId, challengeKey: "closest_to_pin" },
      { playerId: antonio.playerId, challengeKey: "best_putt" },
      { playerId: juan.playerId, challengeKey: "fairway" },
    ];
    const result = computeChallengeTally([antonio, juan], wins);
    expect(result[0].playerId).toBe(antonio.playerId);
    expect(result[0].wins).toBe(2);
    expect(result[1].wins).toBe(1);
  });
});
