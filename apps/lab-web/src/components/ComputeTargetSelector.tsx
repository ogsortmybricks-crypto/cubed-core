import {
  ROUTE_GUIDE_LINK_REL,
  ROUTE_GUIDE_LINK_TARGET,
  routeGuideDocumentHref,
} from "../routeGuideLinks";
import type { GpuCapability, RemoteHost } from "../types";
import "./ComputeTargetSelector.css";

function localCudaSummary(gpu: GpuCapability | null): string {
  if (gpu === null) return "Checking this computer for a graphics card…";
  // The banner above already explains the consequence, so this stays short
  // enough to serve as the select's description without repeating it.
  if (!gpu.available) return "Not available on this computer.";
  const device = gpu.devices[0];
  if (!device) return "Ready to run on this computer's graphics card.";
  const memory =
    typeof device.memory_mib === "number"
      ? ` · ${Math.round(device.memory_mib / 1024)} GiB`
      : "";
  const extra = gpu.devices.length > 1 ? ` · ${gpu.devices.length} GPUs` : "";
  return `${device.name}${memory}${extra}`;
}

/**
 * Selects where one decode job runs. Empty is an intentional value: it means
 * Local CUDA and omits remote_host from the request. Configured remote hosts
 * are opt-in and never replace local as an automatic fallback.
 */
export function ComputeTargetSelector({
  hosts,
  selectedId,
  onChange,
  localGpu,
  idPrefix,
  disabled = false,
  loading = false,
  error = "",
}: {
  hosts: RemoteHost[];
  selectedId: string;
  onChange: (next: string) => void;
  localGpu: GpuCapability | null;
  idPrefix: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
}) {
  const selectedHost =
    hosts.find((host) => host.id === selectedId) ?? null;
  const noteId = `${idPrefix}-compute-target-note`;
  const localGuideId = `${idPrefix}-local-gpu-guide`;
  const remoteGuideId = `${idPrefix}-remote-gpu-guide`;
  const localUnavailable = localGpu !== null && !localGpu.available;

  // A non-technical operator should not have to work out which target is
  // usable. Local is chosen for them whenever this machine can run it. When it
  // cannot, the only remaining choice is offered as one click rather than
  // selected silently: a remote host copies their video to another machine and
  // a rented one bills them, so it stays an explicit decision.
  const localReady = localGpu !== null && localGpu.available;
  const stuckOnUnusableLocal = localUnavailable && !selectedId;
  const soleAlternative =
    stuckOnUnusableLocal && hosts.length === 1 ? hosts[0] : null;

  return (
    <div className="compute-target-control">
      {localReady && !selectedHost && (
        <p className="compute-target-recommendation" role="status">
          <strong>Ready to go.</strong> This computer's graphics card will run
          the decode. Nothing to set up.
        </p>
      )}

      {stuckOnUnusableLocal && (
        <div className="compute-target-recommendation compute-target-recommendation-action">
          <p>
            <strong>This computer cannot run a decode.</strong> It has no
            NVIDIA graphics card. Demo, Add video, Label, and Runs all still
            work.
          </p>
          {soleAlternative ? (
            <button
              className="button button-quiet"
              type="button"
              disabled={disabled}
              onClick={() => onChange(soleAlternative.id)}
            >
              Use {soleAlternative.label} instead
            </button>
          ) : hosts.length > 1 ? (
            <p>Choose one of your configured GPU machines below.</p>
          ) : null}
        </div>
      )}

      <select
        className="compute-target-select"
        id={`${idPrefix}-compute-target-select`}
        value={selectedId}
        disabled={disabled}
        aria-describedby={noteId}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" disabled={localUnavailable}>
          Local CUDA (this workbench)
        </option>
        {hosts.map((host) => (
          <option key={host.id} value={host.id}>
            {host.label}
          </option>
        ))}
      </select>

      <small className="compute-target-note" id={noteId}>
        {selectedHost
          ? "Remote target configured · run readiness to verify it."
          : localCudaSummary(localGpu)}
      </small>

      {loading && (
        <small className="compute-target-message" role="status">
          Checking configured remote hosts…
        </small>
      )}
      {error && (
        <small className="compute-target-message compute-target-error" role="alert">
          Remote hosts could not be loaded: {error}
        </small>
      )}
      {/*
        Only surfaced when this machine cannot run the job. Someone whose own
        graphics card already works does not need to hear about a file they
        have no reason to create.
      */}
      {!loading && !error && hosts.length === 0 && localUnavailable && (
        <small className="compute-target-message">
          No other GPU machine is set up yet. You can add one by creating{" "}
          <code>workspace/remote-hosts.json</code>. The{" "}
          <a
            href={routeGuideDocumentHref("docs/CLOUD_GPU.md")}
            target={ROUTE_GUIDE_LINK_TARGET}
            rel={ROUTE_GUIDE_LINK_REL}
          >
            GPU guide
          </a>{" "}
          walks through it step by step.
        </small>
      )}
      {disabled && (
        <small className="compute-target-message">
          This job keeps the compute target it started with.
        </small>
      )}

      <details className="compute-target-setup">
        <summary>
          <span>
            <strong>Set up a GPU</strong>
            <small>Local CUDA or remote / Vast.ai</small>
          </span>
        </summary>

        <div className="compute-target-setup-body">
          <section aria-labelledby={localGuideId}>
            <header>
              <span>On this machine</span>
              <strong id={localGuideId}>Local CUDA</strong>
            </header>
            <ol>
              <li>
                <span>Prepare the runtime</span>
                <code>make download-assets</code>
                <code>make bootstrap-research-gpu</code>
              </li>
              <li>
                <span>Start the CUDA workbench</span>
                <code>source .venv-decode-gpu/bin/activate</code>
                <code>
                  CUBED_CORE_DECODE_MODE=native make workbench-decode-gpu
                </code>
              </li>
            </ol>
          </section>

          <section aria-labelledby={remoteGuideId}>
            <header>
              <span>Rented or owned host</span>
              <strong id={remoteGuideId}>Remote / Vast.ai</strong>
            </header>
            <ol>
              <li>
                <span>Rent a CUDA Linux host and attach your SSH public key.</span>
              </li>
              <li>
                <span>Verify non-interactive SSH</span>
                <code>
                  ssh -p &lt;port&gt; -o BatchMode=yes root@&lt;host&gt; true
                </code>
              </li>
              <li>
                <span>Provision and save the connection</span>
                <code>
                  ./scripts/provision_gpu_box.sh --dest
                  root@&lt;host&gt; --port &lt;port&gt; --append-env
                </code>
              </li>
              <li>
                <span>Start this workbench</span>
                <code>make hub</code>
              </li>
              <li>
                <span>
                  Select the configured target above, then use Refresh readiness
                  before Run decode.
                </span>
              </li>
            </ol>
          </section>

          <p className="compute-target-setup-footnote">
            These live Decode commands require Linux or WSL2. A listed target
            is configured, not proven ready. Readiness checks SSH, CUDA, and
            required assets.{" "}
            <a
              href={routeGuideDocumentHref("docs/CLOUD_GPU.md")}
              target={ROUTE_GUIDE_LINK_TARGET}
              rel={ROUTE_GUIDE_LINK_REL}
            >
              Open the full GPU guide
            </a>
            .
          </p>
        </div>
      </details>
    </div>
  );
}
