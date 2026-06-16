-- Migration: add_schedule_subject_foreign_key
-- Created at: 1760247013

-- Agregar foreign key constraint de schedule.subject_id a subjects.id
ALTER TABLE schedule 
ADD CONSTRAINT schedule_subject_id_fkey 
FOREIGN KEY (subject_id) 
REFERENCES subjects(id) 
ON DELETE SET NULL;;