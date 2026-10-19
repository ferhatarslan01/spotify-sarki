import { Composition } from "remotion";
import { TopBoard } from "./Composition";
import { NewRelease } from "./NewRelease";
import { RankRise } from "./RankRise";
import { Anniversary } from "./Anniversary";
import { CoverPlayer } from "./CoverPlayer";
import { Duel } from "./Duel";
import { Era90s } from "./Era90s";
import board from "./data-board.json";
import fresh from "./data-new.json";
import rise from "./data-rise.json";
import anniv from "./data-anniv.json";
import player from "./data-player.json";
import duel from "./data-duel.json";
import era90 from "./data-era90.json";

const FPS = 30;
const frames = (seconds: number) => Math.max(1, Math.round(seconds * FPS));

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TopBoard"
        component={TopBoard}
        durationInFrames={frames(board.durationSeconds)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="NewRelease"
        component={NewRelease}
        durationInFrames={frames(fresh.durationSeconds)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="RankRise"
        component={RankRise}
        durationInFrames={frames(rise.durationSeconds)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="Anniversary"
        component={Anniversary}
        durationInFrames={frames(anniv.durationSeconds)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="CoverPlayer"
        component={CoverPlayer}
        durationInFrames={frames(player.durationSeconds)}
        fps={FPS}
        width={1080}
        height={1080}
      />
      <Composition
        id="Era90s"
        component={Era90s}
        durationInFrames={frames(era90.introSeconds + anniv.durationSeconds)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="Duel"
        component={Duel}
        durationInFrames={frames(duel.durationSeconds)}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
