import {
  ArrowUpRight,
  Clock3,
  Leaf,
  MapPin,
  ShoppingBag,
  Wrench,
  ShieldCheck,
} from "lucide-react";
import type { Merchant } from "@/lib/types";
export default function OptionsList({
  options,
  selected,
  onSelect,
  disabled,
}: {
  options: Merchant[];
  selected?: string;
  onSelect: (m: Merchant) => void;
  disabled: boolean;
}) {
  return (
    <div className="options-grid">
      {options.map((m) => {
        const Icon =
          m.category === "car"
            ? Wrench
            : m.category === "shops"
              ? ShoppingBag
              : Leaf;
        return (
          <button
            className={`merchant-card ${selected === m.id ? "selected" : ""}`}
            key={m.id}
            onClick={() => onSelect(m)}
            disabled={disabled}
            aria-pressed={selected === m.id}
          >
            <div className={`merchant-art ${m.color}`}>
              <div className="art-orbit" />
              <Icon size={45} strokeWidth={1.3} />
              <span className="merchant-tag">{m.tag}</span>
              <span className="art-small">
                {m.category === "groceries"
                  ? "FRESH & LOCAL"
                  : "AROUND THE CORNER"}
              </span>
            </div>
            <div className="merchant-body">
              <div className="merchant-heading">
                <h3>{m.name}</h3>
                <ArrowUpRight size={17} />
              </div>
              <p>{m.description}</p>
              <div className="merchant-meta">
                <span>
                  <MapPin size={12} /> {m.distance} km
                </span>
                <span>
                  <Clock3 size={12} /> {m.delivery}
                </span>
              </div>
              <div className="merchant-bottom">
                <span>
                  <ShieldCheck size={14} /> {m.trust}%{" "}
                  <small>sample trust</small>
                </span>
                <strong>
                  ${m.price}
                  <small> est.</small>
                </strong>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
