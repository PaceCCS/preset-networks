"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Server,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Play,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  type HealthStatus,
  type SnapshotValidation,
  type SnapshotComponentValidation,
  type SnapshotResponse,
  type SnapshotConditions,
  type ExtractedCondition,
  type NetworkSource,
  runSnapshot,
  snapshotValidationQueryOptions,
  snapshotHealthQueryOptions,
} from "@/lib/operations";
import { getNetworkSourceFromCollections } from "@/lib/collections/flow";

type SnapshotOperationDialogProps = {
  networkPath: string;
  health?: HealthStatus;
  validation?: SnapshotValidation;
  onClose: () => void;
};

export function SnapshotOperationDialog({
  networkPath,
  health: initialHealth,
  validation: initialValidation,
  onClose,
}: SnapshotOperationDialogProps) {
  const [overrides, setOverrides] = useState<SnapshotConditions>({});
  const [includeAllPipes, setIncludeAllPipes] = useState(false);
  const [result, setResult] = useState<SnapshotResponse | null>(null);
  const [networkSource, setNetworkSource] = useState<NetworkSource | null>(
    null,
  );

  // Load network data from collections on mount
  useEffect(() => {
    getNetworkSourceFromCollections().then(setNetworkSource);
  }, []);

  // Fetch health status
  const { data: health } = useQuery({
    ...snapshotHealthQueryOptions(),
    initialData: initialHealth,
  });

  // Fetch validation using the network data from collections
  // Pass networkPath as baseNetworkId for inheritance
  const { data: validation, isLoading: isValidationLoading } = useQuery({
    ...snapshotValidationQueryOptions(
      networkSource ?? { type: "networkId", networkId: networkPath },
      networkPath,
      networkPath, // baseNetworkId for inheritance
    ),
    initialData: initialValidation,
    enabled: !!networkSource,
  });

  // Run snapshot mutation
  const snapshotMutation = useMutation({
    mutationFn: async () => {
      if (!networkSource) {
        throw new Error("Network data not loaded");
      }
      return runSnapshot(
        networkSource,
        overrides,
        includeAllPipes,
        networkPath,
      );
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const isServerAvailable = health?.status === "ok";
  const canRun = validation?.isReady;

  const handleOverrideChange = (key: string, unit: string, value: string) => {
    if (value === "") {
      // Remove override
      const newOverrides = { ...overrides };
      delete newOverrides[key];
      setOverrides(newOverrides);
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        setOverrides({
          ...overrides,
          [key]: { [unit]: numValue },
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Server Status */}
      <ServerStatusSection health={health} />

      {/* Validation Summary */}
      {isValidationLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading network conditions...
        </div>
      ) : validation ? (
        <ValidationSummarySection
          validation={validation}
          overrides={overrides}
          onOverrideChange={handleOverrideChange}
        />
      ) : null}

      {/* Include All Pipes Toggle */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeAllPipes}
          onChange={(e) => setIncludeAllPipes(e.target.checked)}
          className="rounded border-gray-300"
        />
        Include all pipe segments in response
      </label>

      {/* Results Section */}
      {result && <ResultsSection result={result} />}

      {/* Error Display */}
      {snapshotMutation.isError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3">
          <div className="flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
            <div className="text-sm text-red-800">
              {snapshotMutation.error instanceof Error
                ? snapshotMutation.error.message
                : "An error occurred"}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button
          onClick={() => snapshotMutation.mutate()}
          disabled={!canRun || snapshotMutation.isPending}
        >
          {snapshotMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Simulation
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ServerStatusSection({ health }: { health?: HealthStatus }) {
  const isAvailable = health?.status === "ok";
  const isDegraded = health?.status === "degraded";

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-md border",
        isAvailable && "bg-green-50 border-green-200",
        isDegraded && "bg-yellow-50 border-yellow-200",
        !isAvailable && !isDegraded && "bg-red-50 border-red-200",
      )}
    >
      <Server className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-sm font-medium">Snapshot Server</div>
        <div className="text-xs text-muted-foreground">
          {health?.snapshotServer || "Unknown"}
        </div>
      </div>
      {isAvailable ? (
        <div className="flex items-center gap-1 text-green-600 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          Connected
        </div>
      ) : isDegraded ? (
        <div className="flex items-center gap-1 text-yellow-600 text-sm">
          <AlertCircle className="h-4 w-4" />
          Degraded
        </div>
      ) : (
        <div className="flex items-center gap-1 text-red-600 text-sm">
          <XCircle className="h-4 w-4" />
          Unavailable
        </div>
      )}
    </div>
  );
}

function ValidationSummarySection({
  validation,
  overrides,
  onOverrideChange,
}: {
  validation: SnapshotValidation;
  overrides: SnapshotConditions;
  onOverrideChange: (key: string, unit: string, value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Network Analysis</h4>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="Components"
          value={validation.summary.componentCount}
          status={validation.summary.componentCount > 0 ? "ok" : "error"}
        />
        <StatCard
          label="Total Conditions"
          value={validation.summary.totalConditions}
          status="neutral"
        />
        <StatCard
          label="Extracted"
          value={validation.summary.extractedConditions}
          status={validation.summary.extractedConditions > 0 ? "ok" : "warning"}
        />
        <StatCard
          label="Missing"
          value={validation.summary.missingConditions}
          status={validation.summary.missingConditions > 0 ? "warning" : "ok"}
        />
      </div>

      {/* Component Details */}
      {validation.components.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {validation.components.map((component) => (
            <ComponentValidationCard
              key={`${component.componentType}-${component.componentId}`}
              component={component}
              overrides={overrides}
              onOverrideChange={onOverrideChange}
            />
          ))}
        </div>
      )}

      {/* Readiness Status */}
      <div
        className={cn(
          "flex items-center gap-2 p-2 rounded text-sm",
          validation.isReady
            ? "bg-green-50 text-green-800"
            : "bg-yellow-50 text-yellow-800",
        )}
      >
        {validation.isReady ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Network is ready for simulation
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4" />
            {validation.summary.extractedConditions > 0
              ? "Some required conditions are missing"
              : "No conditions could be extracted from the network"}
          </>
        )}
      </div>
    </div>
  );
}

function ComponentValidationCard({
  component,
  overrides,
  onOverrideChange,
}: {
  component: SnapshotComponentValidation;
  overrides: SnapshotConditions;
  onOverrideChange: (key: string, unit: string, value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border rounded-md"
    >
      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm hover:bg-muted/50">
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="font-medium">{component.componentType}</span>
          <span className="text-muted-foreground">|</span>
          <span>{component.componentId}</span>
          {component.label && (
            <span className="text-xs text-muted-foreground">
              ({component.label})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {component.extractedCount > 0 && (
            <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
              {component.extractedCount} extracted
            </span>
          )}
          {component.missingCount > 0 && (
            <span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
              {component.missingCount} missing
            </span>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t p-2 space-y-1">
          {component.conditions.map((condition) => (
            <ConditionRow
              key={condition.key}
              condition={condition}
              override={overrides[condition.key]}
              onOverrideChange={(value) =>
                onOverrideChange(condition.key, condition.unit, value)
              }
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ConditionRow({
  condition,
  override,
  onOverrideChange,
}: {
  condition: ExtractedCondition;
  override?: Record<string, number | boolean>;
  onOverrideChange: (value: string) => void;
}) {
  const statusColors = {
    extracted: "bg-green-50 border-green-200",
    default: "bg-blue-50 border-blue-200",
    missing: "bg-yellow-50 border-yellow-200",
  };

  const currentValue = condition.value
    ? Object.values(condition.value)[0]
    : null;
  const overrideValue = override ? Object.values(override)[0] : null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded border text-xs",
        statusColors[condition.status],
      )}
    >
      <div className="flex-1">
        <span className="font-medium">{condition.property}</span>
        <span className="text-muted-foreground ml-1">({condition.unit})</span>
      </div>
      <div className="flex items-center gap-2">
        {currentValue !== null && (
          <span className="text-muted-foreground">
            {condition.status === "default" ? "default: " : ""}
            {String(currentValue)}
          </span>
        )}
        <Input
          type="text"
          placeholder={condition.status === "missing" ? "Required" : "Override"}
          value={overrideValue !== null ? String(overrideValue) : ""}
          onChange={(e) => onOverrideChange(e.target.value)}
          className={cn(
            "w-24 h-7 text-xs",
            condition.status === "missing" &&
              !overrideValue &&
              "border-yellow-500",
          )}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status: "ok" | "warning" | "error" | "neutral";
}) {
  const bgClass = {
    ok: "bg-green-50 border-green-200",
    warning: "bg-yellow-50 border-yellow-200",
    error: "bg-red-50 border-red-200",
    neutral: "bg-muted/50 border-border",
  }[status];

  return (
    <div className={cn("p-2 rounded border text-center", bgClass)}>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ResultsSection({ result }: { result: SnapshotResponse }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!result.success) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 p-3">
        <div className="flex items-start gap-2">
          <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-red-800">
              Simulation Failed
            </div>
            <div className="text-sm text-red-700">
              {result.error?.message || "Unknown error"}
            </div>
            {result.report && (
              <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap">
                {result.report}
              </pre>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        Results ({result.components.length} components)
      </h4>

      {/* Thresholds */}
      {result.thresholds && (
        <div className="p-2 bg-muted/50 rounded text-xs space-y-1">
          <div className="font-medium">Thresholds:</div>
          {result.thresholds.minTemperatureInPipeline && (
            <div>
              Min Temp:{" "}
              {result.thresholds.minTemperatureInPipeline.celsius.toFixed(1)}°C
            </div>
          )}
          {result.thresholds.corrosionPotential !== undefined && (
            <div>
              Corrosion Potential:{" "}
              {["None", "Low", "High"][result.thresholds.corrosionPotential]}
            </div>
          )}
        </div>
      )}

      {/* Components */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm hover:bg-muted/50 p-1 rounded w-full">
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Component Results
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
            {result.components.map((component) => (
              <div
                key={`${component.type}-${component.id}`}
                className="p-2 border rounded text-xs"
              >
                <div className="font-medium">
                  {component.type} | {component.id}
                </div>
                {component.inlet?.pressure && (
                  <div className="text-muted-foreground">
                    Inlet P: {component.inlet.pressure.bara.toFixed(2)} bara
                    {component.inlet.temperature && (
                      <>
                        , T: {component.inlet.temperature.celsius.toFixed(1)}°C
                      </>
                    )}
                    {component.inlet.flowrate && (
                      <>
                        , Flow:{" "}
                        {component.inlet.flowrate.tonnePerHour.toFixed(1)} t/h
                      </>
                    )}
                  </div>
                )}
                {component.outlet?.pressure && (
                  <div className="text-muted-foreground">
                    Outlet P: {component.outlet.pressure.bara.toFixed(2)} bara
                    {component.outlet.temperature && (
                      <>
                        , T: {component.outlet.temperature.celsius.toFixed(1)}°C
                      </>
                    )}
                  </div>
                )}
                {component.workDone && (
                  <div className="text-muted-foreground">
                    Work: {component.workDone.kiloWatts.toFixed(1)} kW
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
