import { Composition } from "remotion";
import { TopBoard } from "./Composition";
import { NewRelease } from "./NewRelease";
import { RankRise } from "./RankRise";
import { Anniversary } from "./Anniversary";
import { CoverPlayer } from "./CoverPlayer";
import { Duel } from "./Duel";
import { EraIntro } from "./EraIntro";
import { NRFragman } from "./NRFragman";
import { NRBulten } from "./NRBulten";
import { NRKilit } from "./NRKilit";
import { NRNeon } from "./NRNeon";
import { NRKaset } from "./NRKaset";
import { NRTahmin } from "./NRTahmin";
import { NRRadyo } from "./NRRadyo";
import { NRMesaj } from "./NRMesaj";
import board from "./data-board.json";
import fresh from "./data-new.json";
import rise from "./data-rise.json";
import anniv from "./data-anniv.json";
import player from "./data-player.json";
import duel from "./data-duel.json";
import eraintro from "./data-eraintro.json";
import nrvar from "./data-nrvar.json";

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
        id="EraIntro"
        component={EraIntro}
        durationInFrames={frames(eraintro.introSeconds + anniv.durationSeconds)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      {/* "Yeni cikti" sablon ailesi: ortak veri dosyasi data-nrvar.json (her render tek sablonu isler) */}
      <Composition
        id="NRFragman"
        component={NRFragman}
        durationInFrames={frames(nrvar.durationSeconds)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="NRBulten"
        component={NRBulten}
        durationInFrames={frames(nrvar.durationSeconds)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="NRKilit"
        component={NRKilit}
        durationInFrames={frames(nrvar.durationSeconds)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="NRNeon"
        component={NRNeon}
        durationInFrames={frames(nrvar.durationSeconds)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="NRKaset"
        component={NRKaset}
        durationInFrames={frames(nrvar.durationSeconds)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="NRTahmin"
        component={NRTahmin}
        durationInFrames={frames(nrvar.durationSeconds)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="NRRadyo"
        component={NRRadyo}
        durationInFrames={frames(nrvar.durationSeconds)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="NRMesaj"
        component={NRMesaj}
        durationInFrames={frames(nrvar.durationSeconds)}
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
