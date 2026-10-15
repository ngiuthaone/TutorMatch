"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { TEST_INTENDED_LEARNERS } from "../test-data";

export interface IntendedLearnersData {
  outcomes: string[];
  requirements: string[];
  audiences: string[];
}

export interface IntendedLearnersPageProps {
  initialData?: Partial<IntendedLearnersData>;
  onChange?: (data: IntendedLearnersData) => void;
}

const MIN_OUTCOMES = 4;
const MIN_REQUIREMENTS = 1;
const MIN_AUDIENCES = 1;

const DEFAULT_OUTCOMES = TEST_INTENDED_LEARNERS.outcomes;
const DEFAULT_REQUIREMENTS = TEST_INTENDED_LEARNERS.requirements;
const DEFAULT_AUDIENCES = TEST_INTENDED_LEARNERS.audiences;

function ensureLength(arr: string[] | undefined, fallback: string[]): string[] {
  if (arr && arr.length) return arr.slice();
  return fallback.slice();
}

interface ListEditorProps {
  title: string;
  description: string;
  items: string[];
  minimum: number;
  onChange: (items: string[]) => void;
  arrayName: string;
}

function ListEditor({ title, description, items, minimum, onChange, arrayName }: ListEditorProps) {
  const canDelete = items.length > minimum;

  const update = (index: number, value: string) => {
    const next = items.slice();
    next[index] = value;
    onChange(next);
  };

  const remove = (index: number) => {
    if (!canDelete) return;
    const next = items.slice();
    next.splice(index, 1);
    onChange(next);
  };

  const add = () => {
    onChange([...items, ""]);
  };

  return (
    <section className="section">
      <h2 className="section-title">{title}</h2>
      <p className="section-desc">{description}</p>
      <div className="stack">
        {items.map((value, index) => (
          <div key={index} className="list-field">
            <div className="list-number">{index + 1}</div>
            <input
              type="text"
              className="field"
              value={value}
              onChange={(event) => update(index, event.target.value)}
              data-array={arrayName}
              data-index={index}
            />
            <button
              type="button"
              className="icon-btn"
              onClick={() => remove(index)}
              disabled={!canDelete}
              aria-label={`Delete item ${index + 1}`}
              data-remove-array={arrayName}
              data-index={index}
            >
              <Trash2 className="icon" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="btn btn-sm" data-add-array={arrayName} style={{ marginTop: 12 }}>
        <Plus className="icon" />
        <span>Add more</span>
      </button>
    </section>
  );
}

export function IntendedLearnersPage({ initialData, onChange }: IntendedLearnersPageProps) {
  const [outcomes, setOutcomes] = useState<string[]>(() =>
    ensureLength(initialData?.outcomes, DEFAULT_OUTCOMES),
  );
  const [requirements, setRequirements] = useState<string[]>(() =>
    ensureLength(initialData?.requirements, DEFAULT_REQUIREMENTS),
  );
  const [audiences, setAudiences] = useState<string[]>(() =>
    ensureLength(initialData?.audiences, DEFAULT_AUDIENCES),
  );

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    onChangeRef.current?.({ outcomes, requirements, audiences });
  }, [outcomes, requirements, audiences]);

  const updateOutcomes = useCallback((next: string[]) => setOutcomes(next), []);
  const updateRequirements = useCallback((next: string[]) => setRequirements(next), []);
  const updateAudiences = useCallback((next: string[]) => setAudiences(next), []);

  return (
      <div>
      <ListEditor
        title="What will students learn in your course?"
        description="Enter at least four learning objectives or outcomes students can expect to achieve after completing your course."
        items={outcomes}
        minimum={MIN_OUTCOMES}
        onChange={updateOutcomes}
        arrayName="outcomes"
      />

      <ListEditor
        title="What are the requirements or prerequisites for taking your course?"
        description="List the required skills, experience, tools, or equipment. If there are no requirements, use this space to lower the barrier for beginners."
        items={requirements}
        minimum={MIN_REQUIREMENTS}
        onChange={updateRequirements}
        arrayName="requirements"
      />

      <ListEditor
        title="Who is this course for?"
        description="Write a clear description of the intended learners who will find your content valuable."
        items={audiences}
        minimum={MIN_AUDIENCES}
        onChange={updateAudiences}
        arrayName="audiences"
      />
    </div>
  );
}

export default IntendedLearnersPage;
