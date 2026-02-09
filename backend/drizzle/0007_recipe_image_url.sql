-- Migration: Add image_url column to recipes table (Spec 005)
-- Stores recipe image URL scraped from og:image or recipe structured data

ALTER TABLE "recipes" ADD COLUMN "image_url" text;
