import { ToolTurnUI } from "@/lib/tool-turn-ui";

type ToolTurnParams = Record<string, unknown>;
type ToolTurnRecord = Record<string, unknown>;
type ToolTurnUiBuilder = (
  result: ToolTurnRecord,
  params: ToolTurnParams
) => ToolTurnUI | undefined;

const BUILTIN_TOOL_TURN_UI_BUILDERS: Record<string, ToolTurnUiBuilder> = {
  get_job_details: buildJobToolTurnUI,
  get_node_details: buildNodeToolTurnUI,
  get_partition_details: buildPartitionToolTurnUI,
  get_reservation_details: buildReservationToolTurnUI,
  list_reservations: buildReservationListToolTurnUI,
  get_qos_details: buildQosToolTurnUI,
  get_cluster_info: buildClusterToolTurnUI,
  list_qos: buildQosListToolTurnUI,
  list_partitions: buildPartitionListToolTurnUI,
  search_documentation: buildDocumentationSearchToolTurnUI,
  troubleshoot_job: buildTroubleshootJobToolTurnUI,
  sbatch_helper: buildSbatchHelperToolTurnUI,
  node_health_check: buildNodeHealthCheckToolTurnUI,
};

export function buildBuiltinToolTurnUI(
  toolId: string,
  result: unknown,
  params: ToolTurnParams = {}
): ToolTurnUI | undefined {
  const builder = BUILTIN_TOOL_TURN_UI_BUILDERS[toolId];
  const resultRecord = asRecord(result);

  if (!builder || !resultRecord) {
    return undefined;
  }

  return builder(resultRecord, params);
}

function buildJobToolTurnUI(
  result: ToolTurnRecord,
  params: ToolTurnParams
): ToolTurnUI {
  const requestedJob = getString(params.job, "the requested job");

  if (typeof result.error === "string") {
    return {
      details: {
        title: "Operational Details",
        intro: result.error,
        items: [
          {
            label: "Recommended check",
            value: `squeue -j ${requestedJob}`,
            tone: "info",
            code: true,
          },
        ],
        notes: [
          "If the job is no longer active, switch to historical accounting with sacct.",
        ],
      },
      followUpContext:
        "A job details card was shown. Generate follow-up questions about job state interpretation, queue status, exit handling, resource fit, and the next Slurm command to run.",
    };
  }

  const job = getFirstRecord(result.jobs);
  const jobId = getString(job?.job_id, requestedJob);
  const primaryState = getJobPrimaryState(job);
  const stateReason = getString(asRecord(job?.state)?.reason);
  const isHistorical = result.jobStatus === "completed";
  const exitCode = getNumber(asRecord(job?.exit_code)?.return_code);

  return {
    details: {
      title: "Operational Details",
      intro: getJobIntro(primaryState, isHistorical, stateReason),
      items: [
        {
          label: "Record source",
          value: isHistorical
            ? "Historical accounting record"
            : "Active scheduler record",
        },
        {
          label: "Recommended check",
          value: isHistorical
            ? `sacct -j ${jobId} --format=JobID,State,ExitCode,Elapsed`
            : `squeue -j ${jobId}`,
          tone: "info",
          code: true,
        },
        ...(stateReason
          ? [
              {
                label: "Current blocker",
                value: stateReason,
                tone: primaryState === "PENDING" ? ("warning" as const) : ("default" as const),
              },
            ]
          : []),
      ],
      notes: getJobNotes(primaryState, exitCode),
    },
    followUpContext:
      "A job details card and deterministic operational summary were shown. Generate follow-up questions about the job state, queue reason, exit behavior, runtime, resource fit, and the next Slurm command to run.",
  };
}

function buildNodeToolTurnUI(
  result: ToolTurnRecord,
  params: ToolTurnParams
): ToolTurnUI {
  const requestedNode = getString(params.node, "the requested node");

  if (typeof result.error === "string") {
    return {
      details: {
        title: "Operational Details",
        intro: result.error,
        items: [
          {
            label: "Recommended check",
            value: `sinfo -N -l | grep ${requestedNode}`,
            tone: "info",
            code: true,
          },
        ],
        notes: getAvailableEntityNotes(result.availableNodes),
      },
      followUpContext:
        "A node lookup returned an error or fallback list. Generate follow-up questions about locating the right node name, checking node state, and verifying whether the node is drained, down, or reserved.",
    };
  }

  const node = getFirstRecord(result.nodes);
  const nodeName =
    getString(node?.name) ||
    getString(node?.node_name) ||
    getString(node?.hostname) ||
    requestedNode;
  const state = getNodePrimaryState(node);
  const reason = getString(node?.reason);
  const reservation = getString(node?.reservation);

  return {
    details: {
      title: "Operational Details",
      intro: getNodeIntro(state, reason),
      items: [
        {
          label: "Recommended check",
          value: `scontrol show node ${nodeName}`,
          tone: "info",
          code: true,
        },
        ...(reservation
          ? [
              {
                label: "Reservation",
                value: reservation,
                tone: "warning" as const,
              },
            ]
          : []),
      ],
      notes: getNodeNotes(state, reason),
    },
    followUpContext:
      "A node details card and deterministic operational summary were shown. Generate follow-up questions about node state, drain reasons, reservations, partition membership, and next health checks.",
  };
}

function buildPartitionToolTurnUI(result: ToolTurnRecord): ToolTurnUI {
  if (typeof result.error === "string") {
    return {
      details: {
        title: "Operational Details",
        intro: result.error,
        items: [
          {
            label: "Recommended check",
            value: "sinfo -s",
            tone: "info",
            code: true,
          },
        ],
        notes: getAvailableEntityNotes(result.availablePartitions),
      },
      followUpContext:
        "A partition lookup returned an error or fallback list. Generate follow-up questions about choosing the correct partition, checking partition state, and comparing limits.",
    };
  }

  const partition = getFirstRecord(result.partitions);
  const name = getString(partition?.name, "this partition");
  const state =
    getString(getFirstValue(asArray(asRecord(partition?.partition)?.state))) ||
    getString(partition?.state, "UNKNOWN");

  return {
    details: {
      title: "Operational Details",
      intro:
        state === "UP"
          ? "This partition is available for scheduling. Use it only if its time and resource limits fit your job."
          : `This partition is currently ${state}. Check availability before choosing it for submission.`,
      items: [
        {
          label: "Recommended check",
          value: `scontrol show partition ${name}`,
          tone: "info",
          code: true,
        },
      ],
      notes:
        state === "UP"
          ? [
              "Compare the partition time limit and QoS with your requested walltime before submitting.",
            ]
          : [
              "If the partition is down or draining, ask for an alternative partition before submitting the job.",
            ],
    },
    followUpContext:
      "A partition details card and deterministic operational summary were shown. Generate follow-up questions about partition suitability, limits, availability, and alternative partitions.",
  };
}

function buildReservationToolTurnUI(
  result: ToolTurnRecord,
  params: ToolTurnParams
): ToolTurnUI {
  const requestedReservation = getString(
    params.reservation,
    "the requested reservation"
  );
  const fallbackReservations = getRecordArray(result.availableReservations);
  const primaryReservation =
    getFirstRecord(result.reservations) || getFirstRecord(result.availableReservations);
  const reservationName = getString(primaryReservation?.name, requestedReservation);

  if (typeof result.error === "string") {
    return {
      details: {
        title: "Operational Details",
        intro: result.error,
        items: [
          {
            label: "Recommended check",
            value: `scontrol show reservation ${reservationName}`,
            tone: "info",
            code: true,
          },
        ],
        notes: [
          fallbackReservations.length > 0
            ? "Use the exact reservation name shown in the card if you want to ask for that reservation specifically."
            : "Ask for the reservation list if you need to discover the current reservation names.",
        ],
      },
      followUpContext:
        "A reservation lookup card and deterministic operational summary were shown. Generate follow-up questions about reservation timing, affected nodes, access scope, and how to inspect a specific reservation by name.",
    };
  }

  return {
    details: {
      title: "Operational Details",
      intro:
        "Use the reservation card to verify timing, affected nodes, flags, and access scope before making scheduling decisions.",
      items: [
        {
          label: "Recommended check",
          value: `scontrol show reservation ${reservationName}`,
          tone: "info",
          code: true,
        },
      ],
      notes: [
        "Confirm that your user or account is included in the reservation access scope before depending on it.",
      ],
    },
    followUpContext:
      "A reservation card and deterministic operational summary were shown. Generate follow-up questions about reservation timing, affected nodes, flags, access scope, and the next Slurm command to run.",
  };
}

function buildReservationListToolTurnUI(result: ToolTurnRecord): ToolTurnUI {
  const reservations = getRecordArray(result.reservations);
  const reservationCount = reservations.length;

  return {
    details: {
      title: "Operational Details",
      intro:
        reservationCount > 0
          ? `The card shows ${reservationCount} reservation${reservationCount === 1 ? "" : "s"}. Use the exact reservation name shown there for a more specific lookup.`
          : "The card shows that no current reservations were returned.",
      items: [
        {
          label: "Recommended check",
          value: "scontrol show reservations",
          tone: "info",
          code: true,
        },
      ],
      notes: [
        "Ask for a reservation by exact name if you need a single reservation detail view.",
      ],
    },
    followUpContext:
      "A reservation list card and deterministic operational summary were shown. Generate follow-up questions about reservation timing, affected nodes, flags, access scope, and how to inspect a specific reservation by name.",
  };
}

function buildQosToolTurnUI(result: ToolTurnRecord, params: ToolTurnParams): ToolTurnUI {
  const requestedQos = getString(params.qos, "the requested QoS");

  if (typeof result.error === "string") {
    return {
      details: {
        title: "Operational Details",
        intro: result.error,
        items: [
          {
            label: "Recommended check",
            value: "sacctmgr show qos format=Name,Priority,MaxJobsPU,MaxSubmitPU,MaxWall",
            tone: "info",
            code: true,
          },
        ],
        notes: result.availableQoS
          ? [`Available QoS values: ${String(result.availableQoS)}`]
          : [`Ask for QoS details again using an exact name instead of ${requestedQos}.`],
      },
      followUpContext:
        "A QoS lookup returned an error or fallback list. Generate follow-up questions about choosing a QoS, checking limits, and matching QoS to workload requirements.",
    };
  }

  const qos = getFirstRecord(result.qos);
  const name = getString(qos?.name, requestedQos);

  return {
    details: {
      title: "Operational Details",
      intro:
        "Use the QoS card to confirm limits, then match walltime and job concurrency to those limits before you submit.",
      items: [
        {
          label: "Recommended check",
          value: `sacctmgr show qos ${name} format=Name,Priority,MaxJobsPU,MaxSubmitPU,MaxWall`,
          tone: "info",
          code: true,
        },
      ],
      notes: [
        "If your workload needs more time or more concurrent jobs than this QoS allows, choose a different QoS before submission.",
      ],
    },
    followUpContext:
      "A QoS details card and deterministic operational summary were shown. Generate follow-up questions about walltime limits, submission limits, preemption, priority, and choosing the right QoS for a workload.",
  };
}

function buildClusterToolTurnUI(result: ToolTurnRecord): ToolTurnUI {
  const cluster = getFirstRecord(result.clusters);
  const name = getString(cluster?.name, "the cluster");

  return {
    details: {
      title: "Operational Details",
      intro: `The card shows cluster metadata for ${name}. Use it to confirm the environment before making broader scheduling decisions.`,
      items: [
        {
          label: "Recommended check",
          value: "sinfo",
          tone: "info",
          code: true,
        },
      ],
      notes: [
        "If you need capacity or availability details, ask next about partitions, QoS, or a specific node instead of the cluster summary.",
      ],
    },
    followUpContext:
      "A cluster information card and deterministic operational summary were shown. Generate follow-up questions about partitions, QoS, node availability, and cluster capacity.",
  };
}

function buildQosListToolTurnUI(result: ToolTurnRecord): ToolTurnUI {
  const qosCount = getRecordArray(result.qos).length;

  return {
    details: {
      title: "Operational Details",
      intro: `The card shows ${qosCount} QoS option${qosCount === 1 ? "" : "s"}. Choose one by exact name if you need limit details before submitting a job.`,
      items: [
        {
          label: "Recommended check",
          value: "sacctmgr show qos format=Name,Priority,MaxJobsPU,MaxSubmitPU,MaxWall",
          tone: "info",
          code: true,
        },
      ],
    },
    followUpContext:
      "A QoS list card and deterministic operational summary were shown. Generate follow-up questions about comparing QoS options, choosing a QoS for a workload, and checking specific QoS limits.",
  };
}

function buildPartitionListToolTurnUI(result: ToolTurnRecord): ToolTurnUI {
  const partitionCount = getRecordArray(result.partitions).length;

  return {
    details: {
      title: "Operational Details",
      intro: `The card shows ${partitionCount} partition${partitionCount === 1 ? "" : "s"}. Use the exact partition name for a detailed limit and availability lookup.`,
      items: [
        {
          label: "Recommended check",
          value: "sinfo -s",
          tone: "info",
          code: true,
        },
      ],
      notes: [
        "Compare partition time limits and node classes before choosing where to submit a job.",
      ],
    },
    followUpContext:
      "A partition list card and deterministic operational summary were shown. Generate follow-up questions about comparing partitions, checking limits, and selecting the right partition for a workload.",
  };
}

function buildDocumentationSearchToolTurnUI(
  result: ToolTurnRecord,
  params: ToolTurnParams
): ToolTurnUI {
  const resultCount = getRecordArray(result.results).length;
  const source = asRecord(result.source);
  const documentationUrl = getString(source?.documentationUrl, "the configured documentation site");
  const query = getString(result.query, getString(params.query, "the search query"));

  if (typeof result.error === "string") {
    return {
      details: {
        title: "Documentation Search",
        intro: result.error,
        items: [
          {
            label: "Configured docs",
            value: documentationUrl,
            tone: "info",
            code: true,
          },
        ],
        notes: [
          "If the docs URL is correct but search returned no pages, check whether the site exposes a sitemap or public internal links.",
        ],
      },
      followUpContext:
        "A documentation search returned an error. Generate follow-up questions about the docs URL, alternate search terms, and contacting support for policy details.",
    };
  }

  return {
    details: {
      title: "Documentation Search",
      intro:
        resultCount > 0
          ? `The documentation search found ${resultCount} relevant page${resultCount === 1 ? "" : "s"} for "${query}".`
          : `The documentation search did not find a matching page for "${query}".`,
      items: [
        {
          label: "Source",
          value: documentationUrl,
          tone: "info",
          code: true,
        },
      ],
      notes:
        resultCount > 0
          ? [
              "Use only the returned snippets and source URLs for site-specific policy or support details.",
            ]
          : [
              "Try a narrower query or use the configured support contact if this is a policy question.",
            ],
    },
    followUpContext:
      "A documentation search card and source URLs were shown. Generate follow-up questions about policy details, support channels, examples from the docs, and related documentation pages.",
  };
}

function buildTroubleshootJobToolTurnUI(result: ToolTurnRecord): ToolTurnUI {
  if (typeof result.error === "string") {
    return {
      details: {
        title: "Operational Details",
        intro: result.error,
        items: [
          {
            label: "Recommended check",
            value: "squeue -u $USER",
            tone: "info",
            code: true,
          },
        ],
      },
      followUpContext:
        "A troubleshooting workflow returned an error. Generate follow-up questions about locating the correct job ID and gathering queue or accounting data.",
    };
  }

  const job = getFirstRecord(asRecord(result.job)?.jobs);
  const primaryState = getJobPrimaryState(job);

  return {
    details: {
      title: "Operational Details",
      intro:
        "The troubleshooting card combines the job record with nearby scheduler context so the next step should target the current failure or queue blocker directly.",
      items: [
        {
          label: "Primary diagnosis",
          value: getJobIntro(primaryState, asRecord(result.job)?.jobStatus === "completed", getString(asRecord(job?.state)?.reason)),
          tone:
            primaryState === "FAILED" ||
            primaryState === "NODE_FAIL" ||
            primaryState === "OUT_OF_MEMORY" ||
            primaryState === "TIMEOUT"
              ? "warning"
              : "default",
        },
      ],
      notes: [
        "Use the job card for raw facts and the troubleshooting summary to decide whether to resubmit, change resources, or inspect node health.",
      ],
    },
    followUpContext:
      "A troubleshooting workflow card and deterministic operational summary were shown. Generate follow-up questions about the diagnosis, root cause, resubmission changes, node issues, and the next diagnostic command.",
  };
}

function buildSbatchHelperToolTurnUI(result: ToolTurnRecord): ToolTurnUI {
  const partitionCount = getRecordArray(asRecord(result.partitions)?.partitions).length;
  const qosCount = getRecordArray(asRecord(result.qos)?.qos).length;

  return {
    details: {
      title: "Preparation Details",
      intro:
        "The card shows the scheduler context the assistant should use when drafting an sbatch script. The next prose response should turn that context into a concrete script.",
      items: [
        {
          label: "Visible options",
          value: `${partitionCount} partition${partitionCount === 1 ? "" : "s"} and ${qosCount} QoS option${qosCount === 1 ? "" : "s"}`,
        },
      ],
      notes: [
        "The script draft should align partition, QoS, walltime, and resources with the cluster options shown in the card.",
      ],
    },
    followUpContext:
      "An sbatch helper card and deterministic preparation summary were shown. Generate follow-up questions about partition choice, QoS choice, walltime, resources, modules, and script structure.",
  };
}

function buildNodeHealthCheckToolTurnUI(result: ToolTurnRecord): ToolTurnUI {
  if (typeof result.error === "string") {
    return {
      details: {
        title: "Operational Details",
        intro: result.error,
        items: [
          {
            label: "Recommended check",
            value: "sinfo -N -l",
            tone: "info",
            code: true,
          },
        ],
        notes: getAvailableEntityNotes(result.availableNodes),
      },
      followUpContext:
        "A node health workflow returned an error or fallback list. Generate follow-up questions about locating the correct node name and checking node health state.",
    };
  }

  const node = getFirstRecord(asRecord(result.node)?.nodes);
  const state = getNodePrimaryState(node);

  return {
    details: {
      title: "Operational Details",
      intro:
        "This health check combines the node card with cluster context so the next step should focus on the health risk or scheduling risk shown there.",
      items: [
        {
          label: "Health focus",
          value: getNodeIntro(state, getString(node?.reason)),
          tone:
            state === "DOWN" || state === "DRAIN" || state === "DRAINED"
              ? "warning"
              : "default",
        },
      ],
      notes: [
        "If the node is down, drained, or reserved, avoid scheduling to it until the reason is cleared.",
      ],
    },
    followUpContext:
      "A node health workflow card and deterministic operational summary were shown. Generate follow-up questions about the node health issue, reservation status, partition impact, and the next command to confirm recovery.",
  };
}

function getJobIntro(
  primaryState: string,
  isHistorical: boolean,
  stateReason: string
) {
  switch (primaryState) {
    case "RUNNING":
      return "The job is actively running on allocated resources. Use the card to verify the node set and keep checking runtime against the time limit.";
    case "PENDING":
      return stateReason
        ? `The job is queued and currently blocked by ${stateReason}.`
        : "The job is queued and waiting for scheduler conditions to clear.";
    case "COMPLETED":
      return "The job completed successfully and the historical record is available for review.";
    case "FAILED":
    case "NODE_FAIL":
    case "OUT_OF_MEMORY":
      return "The job ended unsuccessfully and should be reviewed before resubmission.";
    case "TIMEOUT":
      return "The job exceeded its time limit and likely needs a larger walltime or a shorter runtime.";
    case "CANCELLED":
      return isHistorical
        ? "The historical record shows the job was cancelled before completing."
        : "The active scheduler record shows the job has been cancelled.";
    default:
      return isHistorical
        ? "The historical job record is available for inspection."
        : "The active job record is available for inspection.";
  }
}

function getJobNotes(primaryState: string, exitCode?: number) {
  const notes: string[] = [];

  if (primaryState === "PENDING") {
    notes.push("If the job is waiting on resources or priority, compare its requests with the target partition and QoS before changing the script.");
  }

  if (
    primaryState === "FAILED" ||
    primaryState === "NODE_FAIL" ||
    primaryState === "OUT_OF_MEMORY"
  ) {
    notes.push("Check the stderr file and the exit code before resubmitting so you do not repeat the same failure.");
  }

  if (primaryState === "TIMEOUT") {
    notes.push("Increase walltime only after confirming the runtime is expected and not caused by an avoidable slowdown.");
  }

  if (typeof exitCode === "number" && exitCode !== 0) {
    notes.push(`The recorded exit code was ${exitCode}, so treat the run as unsuccessful even if the allocation finished cleanly.`);
  }

  return notes;
}

function getNodeIntro(state: string, reason: string) {
  if (state === "IDLE") {
    return "The node is available for scheduling unless a reservation or partition policy blocks it.";
  }

  if (state === "ALLOCATED" || state === "MIXED") {
    return "The node is currently in use. Check load and allocations before assuming spare capacity is available.";
  }

  if (state === "DOWN" || state === "DRAIN" || state === "DRAINED") {
    return reason
      ? `The node is unavailable because ${reason}.`
      : "The node is unavailable and should be treated as unschedulable until it returns to service.";
  }

  return reason
    ? `The node needs attention because ${reason}.`
    : "The node details are available; verify state and reservations before using it.";
}

function getNodeNotes(state: string, reason: string) {
  if (state === "DOWN" || state === "DRAIN" || state === "DRAINED") {
    return [
      reason
        ? `Do not schedule new work here until the drain/down reason is cleared: ${reason}.`
        : "Do not schedule new work here until the node returns to an available state.",
    ];
  }

  return [
    "If you are checking this node for a specific job, compare the node state with the job's current partition and reservation constraints.",
  ];
}

function getJobPrimaryState(job?: ToolTurnRecord) {
  const stateCurrent = asRecord(job?.state)?.current;
  const stateList = getStringArray(stateCurrent ?? job?.job_state);
  return stateList[0] || "UNKNOWN";
}

function getNodePrimaryState(node?: ToolTurnRecord) {
  const stateList = getStringArray(node?.state);
  return stateList[0] || "UNKNOWN";
}

function getAvailableEntityNotes(value: unknown) {
  const stringValue = getString(value);
  return stringValue ? [`Available values: ${stringValue}`] : [];
}

function getFirstRecord(value: unknown) {
  return asRecord(getFirstValue(asArray(value)));
}

function getFirstValue(values: unknown[]) {
  return values.length > 0 ? values[0] : undefined;
}

function getRecordArray(value: unknown) {
  return asArray(value).map(asRecord).filter((entry): entry is ToolTurnRecord => Boolean(entry));
}

function getStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  if (typeof value === "string" && value.length > 0) {
    return [value];
  }

  return [];
}

function getString(value: unknown, fallback = "") {
  return typeof value === "string"
    ? value
    : typeof value === "number"
      ? String(value)
      : fallback;
}

function getNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (isRecordWithNumber(value)) return value.number;
  return undefined;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null
    ? (value as ToolTurnRecord)
    : undefined;
}

function isRecordWithNumber(
  value: unknown
): value is {
  number: number;
} {
  return typeof value === "object" && value !== null && typeof (value as { number?: unknown }).number === "number";
}
