import { ThreatVectorApp } from "./app";
import "./styles.css";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");

if (!canvas) {
  throw new Error("Missing #scene canvas");
}

const app = new ThreatVectorApp(canvas);
void app.start();

