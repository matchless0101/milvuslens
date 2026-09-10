import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Filter } from "lucide-react";

interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface FieldInfo {
  name: string;
  type: string;
}

interface FilterBuilderProps {
  fields: FieldInfo[];
  filter: string;
  onFilterChange: (expr: string) => void;
  onApply: () => void;
}

const OPERATORS = [
  { value: "==", label: "等于 (=)" },
  { value: "!=", label: "不等于 (≠)" },
  { value: ">", label: "大于 (>)" },
  { value: ">=", label: "大于等于 (≥)" },
  { value: "<", label: "小于 (<)" },
  { value: "<=", label: "小于等于 (≤)" },
  { value: "like", label: "模糊匹配 (like)" },
];

// Fields that should quote string values
const STRING_TYPES = ["VarChar", "VARCHAR", "String", "string"];

function needsQuotes(fieldType: string, operator: string): boolean {
  if (operator === "like") return true;
  return STRING_TYPES.some((t) => fieldType.toLowerCase().includes(t.toLowerCase()));
}

function buildExpression(
  conditions: FilterCondition[],
  logic: "and" | "or",
  fields: FieldInfo[]
): string {
  if (conditions.length === 0) return "";

  const parts = conditions.map((c) => {
    if (!c.field || !c.value) return null;
    const fieldInfo = fields.find((f) => f.name === c.field);
    const type = fieldInfo?.type || "";
    const quoted = needsQuotes(type, c.operator);
    const val = quoted ? `"${c.value}"` : c.value;
    return `${c.field} ${c.operator} ${val}`;
  });

  const valid = parts.filter(Boolean);
  if (valid.length === 0) return "";
  return valid.join(logic === "and" ? " && " : " || ");
}

export function FilterBuilder({
  fields,
  filter,
  onFilterChange,
  onApply,
}: FilterBuilderProps) {
  const [open, setOpen] = useState(false);
  const [logic, setLogic] = useState<"and" | "or">("and");
  const [conditions, setConditions] = useState<FilterCondition[]>([
    { id: "1", field: "", operator: "==", value: "" },
  ]);

  // Sync expression when conditions change
  useEffect(() => {
    const expr = buildExpression(conditions, logic, fields);
    onFilterChange(expr);
  }, [conditions, logic, fields]);

  const addCondition = () => {
    setConditions([
      ...conditions,
      { id: String(Date.now()), field: "", operator: "==", value: "" },
    ]);
  };

  const removeCondition = (id: string) => {
    if (conditions.length <= 1) return;
    setConditions(conditions.filter((c) => c.id !== id));
  };

  const updateCondition = (id: string, updates: Partial<FilterCondition>) => {
    setConditions(
      conditions.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleApply = () => {
    onApply();
    setOpen(false);
  };

  const handleClear = () => {
    setConditions([{ id: "1", field: "", operator: "==", value: "" }]);
    onFilterChange("");
    onApply();
  };

  return (
    <div className="relative">
      <Button
        variant={filter ? "default" : "outline"}
        size="sm"
        onClick={() => setOpen(!open)}
      >
        <Filter className="h-4 w-4 mr-1" />
        筛选
        {filter && <span className="ml-1 text-xs">●</span>}
      </Button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-[480px] bg-card border rounded-lg shadow-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">筛选条件</Label>
            <Select
              value={logic}
              onValueChange={(v) => setLogic(v as "and" | "or")}
            >
              <SelectTrigger className="w-28 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="and">AND (且)</SelectItem>
                <SelectItem value="or">OR (或)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 max-h-60 overflow-auto">
            {conditions.map((cond, idx) => (
              <div key={cond.id} className="flex items-center gap-1.5">
                {idx > 0 && (
                  <span className="text-xs text-muted-foreground w-8 shrink-0 text-center">
                    {logic === "and" ? "且" : "或"}
                  </span>
                )}
                {idx === 0 && <span className="w-8 shrink-0" />}

                <Select
                  value={cond.field}
                  onValueChange={(v) => updateCondition(cond.id, { field: v })}
                >
                  <SelectTrigger className="flex-1 h-8">
                    <SelectValue placeholder="选择字段" />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((f) => (
                      <SelectItem key={f.name} value={f.name}>
                        {f.name}
                        <span className="text-xs text-muted-foreground ml-1">
                          {f.type}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={cond.operator}
                  onValueChange={(v) => updateCondition(cond.id, { operator: v })}
                >
                  <SelectTrigger className="w-28 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="值"
                  value={cond.value}
                  onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                  className="flex-1 h-8"
                  onKeyDown={(e) => e.key === "Enter" && handleApply()}
                />

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={() => removeCondition(cond.id)}
                  disabled={conditions.length <= 1}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <Button size="sm" variant="ghost" onClick={addCondition}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              添加条件
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleClear}>
                清除
              </Button>
              <Button size="sm" onClick={handleApply}>
                应用筛选
              </Button>
            </div>
          </div>

          {/* Preview expression */}
          {filter && (
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded font-mono truncate">
              {filter}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
