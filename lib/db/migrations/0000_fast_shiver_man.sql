CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'minister', 'pa_staff', 'constituency_coordinator', 'media_team', 'grievance_officer');--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'grievance_officer' NOT NULL,
	"is_active" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"title_ta" text,
	"content" text NOT NULL,
	"content_ta" text,
	"image_url" text,
	"thumbnail_url" text,
	"category" text DEFAULT 'general' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"title_ta" text,
	"description" text,
	"description_ta" text,
	"image_url" text,
	"thumbnail_url" text,
	"venue" text NOT NULL,
	"event_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"category" text DEFAULT 'general' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"title_ta" text,
	"description" text,
	"description_ta" text,
	"image_url" text,
	"thumbnail_url" text,
	"activity_date" timestamp with time zone NOT NULL,
	"location" text,
	"category" text DEFAULT 'general' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"media_url" text NOT NULL,
	"thumbnail_url" text,
	"media_type" text DEFAULT 'photo' NOT NULL,
	"album" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "volunteers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_ta" text,
	"email" text,
	"phone" text NOT NULL,
	"ward" text,
	"constituency" text NOT NULL,
	"skills" text,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" serial PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"question_ta" text,
	"answer" text NOT NULL,
	"answer_ta" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "constituencies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_ta" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "constituency_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"roads_built_km" real DEFAULT 0 NOT NULL,
	"water_projects_completed" integer DEFAULT 0 NOT NULL,
	"schools_upgraded" integer DEFAULT 0 NOT NULL,
	"health_clinics_opened" integer DEFAULT 0 NOT NULL,
	"jobs_created" integer DEFAULT 0 NOT NULL,
	"beneficiaries_served" integer DEFAULT 0 NOT NULL,
	"total_projects" integer DEFAULT 0 NOT NULL,
	"completed_projects" integer DEFAULT 0 NOT NULL,
	"ongoing_projects" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grievance_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"grievance_id" integer NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grievance_remarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"grievance_id" integer NOT NULL,
	"remark" text NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"author_id" integer,
	"author_name" text DEFAULT 'Office' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grievance_status_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"grievance_id" integer NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by" integer,
	"changed_by_name" text DEFAULT 'System' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grievance_voter_link_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"grievance_id" integer NOT NULL,
	"voter_id_old" integer,
	"voter_id_new" integer,
	"reason" text DEFAULT 'manual' NOT NULL,
	"changed_by" integer,
	"changed_by_name" text DEFAULT 'System' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grievances" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_no" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"address" text,
	"ward" text,
	"constituency" text DEFAULT 'Tambaram' NOT NULL,
	"priority" text DEFAULT 'Medium' NOT NULL,
	"status" text DEFAULT 'Submitted' NOT NULL,
	"anonymous" boolean DEFAULT false NOT NULL,
	"assigned_to" integer,
	"area_id" integer,
	"polling_station_id" integer,
	"latitude" double precision,
	"longitude" double precision,
	"voter_id" integer,
	"resolved_at" timestamp with time zone,
	"ai_category" text,
	"ai_priority" text,
	"ai_summary" text,
	"ai_summary_ta" text,
	"ai_suggested_route" text,
	"ai_sentiment" text,
	"ai_sentiment_score" integer,
	"ai_embedding" text,
	"ai_triaged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grievances_ticket_no_unique" UNIQUE("ticket_no")
);
--> statement-breakpoint
CREATE TABLE "site_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_name" text NOT NULL,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"title_ta" text,
	"subtitle" text,
	"subtitle_ta" text,
	"cta_text" text,
	"cta_url" text,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wards" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_ta" text,
	"slug" text,
	"ward_type" text,
	"zone_id" integer,
	"area" text,
	"pincode" text,
	"latitude" real,
	"longitude" real,
	"coordinator_name" text,
	"coordinator_phone" text,
	"coordinator_email" text,
	"population" integer,
	"households" integer,
	"notes" text,
	"boundary_geojson" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"ward_id" integer NOT NULL,
	"name" text NOT NULL,
	"name_ta" text,
	"area_type" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pincode_wards" (
	"pincode_id" integer NOT NULL,
	"ward_id" integer NOT NULL,
	CONSTRAINT "pincode_wards_pincode_id_ward_id_pk" PRIMARY KEY("pincode_id","ward_id")
);
--> statement-breakpoint
CREATE TABLE "pincodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"label" text,
	"label_ta" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pincodes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "polling_stations" (
	"id" serial PRIMARY KEY NOT NULL,
	"booth_no" text NOT NULL,
	"sl_no" integer,
	"name" text NOT NULL,
	"name_ta" text,
	"address" text,
	"address_ta" text,
	"ward_id" integer,
	"area_id" integer,
	"pincode" text,
	"voter_type" text DEFAULT 'all' NOT NULL,
	"latitude" real,
	"longitude" real,
	"raw_areas" text,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streets" (
	"id" serial PRIMARY KEY NOT NULL,
	"area_id" integer NOT NULL,
	"name" text NOT NULL,
	"name_ta" text,
	"pincode" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_ta" text,
	"slug" text NOT NULL,
	"type" text DEFAULT 'corporation' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grievance_routing_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"grievance_id" integer NOT NULL,
	"from_officer_id" integer,
	"to_officer_id" integer,
	"reason" text DEFAULT 'auto' NOT NULL,
	"matched_scope" text DEFAULT 'none' NOT NULL,
	"matched_scope_id" integer,
	"changed_by" integer,
	"changed_by_name" text DEFAULT 'System' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "officer_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"ward_id" integer,
	"area_id" integer,
	"polling_station_id" integer,
	"role_label" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "volunteer_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"volunteer_id" integer NOT NULL,
	"ward_id" integer,
	"area_id" integer,
	"polling_station_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voter_imports" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"file_sha256" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"parsed_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"ocr_pages_count" integer DEFAULT 0 NOT NULL,
	"inserted_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error_message" text,
	"preview_json" text,
	"skipped_json" text,
	"expected_booth_no" text,
	"uploaded_by" integer,
	"uploaded_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "voters" (
	"id" serial PRIMARY KEY NOT NULL,
	"epic_number" text NOT NULL,
	"full_name" text NOT NULL,
	"full_name_ta" text,
	"age" integer,
	"gender" text,
	"relation_type" text,
	"relation_name" text,
	"relation_name_ta" text,
	"house_number" text,
	"address_line" text,
	"polling_station_id" integer,
	"part_number" text,
	"serial_in_part" integer,
	"source_import_id" integer,
	"source_pdf" text,
	"source_page" integer,
	"household_id" integer,
	"phone" text,
	"whatsapp_opt_in" boolean DEFAULT false NOT NULL,
	"email" text,
	"alt_contact" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voter_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"voter_id" integer NOT NULL,
	"body" text NOT NULL,
	"author_id" integer,
	"author_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voter_tag_assignments" (
	"voter_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"assigned_by" integer,
	"assigned_by_name" text,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voter_tag_assignments_voter_id_tag_id_pk" PRIMARY KEY("voter_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "voter_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_ta" text,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voter_contact_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"voter_id" integer NOT NULL,
	"contact_type" text NOT NULL,
	"direction" text DEFAULT 'out' NOT NULL,
	"outcome" text,
	"summary" text NOT NULL,
	"contacted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"contacted_by" integer,
	"contacted_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voter_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"voter_id" integer NOT NULL,
	"related_voter_id" integer NOT NULL,
	"kind" text NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voter_segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"filter_json" jsonb NOT NULL,
	"owner_user_id" integer,
	"owner_name" text NOT NULL,
	"shared_with_role" text,
	"pinned" boolean DEFAULT false NOT NULL,
	"last_count" integer,
	"last_count_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" serial PRIMARY KEY NOT NULL,
	"polling_station_id" integer,
	"address_key" text NOT NULL,
	"label" text,
	"manually_edited" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voter_exports" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_name" text NOT NULL,
	"format" text NOT NULL,
	"filter_json" text NOT NULL,
	"filter_summary" text DEFAULT '' NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"threshold_at_export" integer DEFAULT 5000 NOT NULL,
	"password_gate_passed" text DEFAULT 'false' NOT NULL,
	"masked" text DEFAULT 'false' NOT NULL,
	"file_hash" text,
	"file_size_bytes" integer,
	"storage_key" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"handle" text NOT NULL,
	"display_name" text,
	"profile_url" text NOT NULL,
	"external_account_id" text,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"scopes" text,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_post_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"platform" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"platform_post_id" text,
	"platform_post_url" text,
	"error" text,
	"attempted_at" timestamp with time zone,
	"posted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"content_ta" text,
	"media_urls" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_by" integer,
	"created_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_stats_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"followers" integer,
	"following" integer,
	"posts_count" integer,
	"raw" jsonb DEFAULT '{}'::jsonb,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promises" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"title_ta" text,
	"description" text,
	"description_ta" text,
	"category" text DEFAULT 'general' NOT NULL,
	"status" text DEFAULT 'announced' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"announced_at" timestamp with time zone,
	"target_date" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"image_url" text,
	"proof_url" text,
	"ward_id" integer,
	"display_order" integer DEFAULT 0 NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "press_coverage" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"snippet" text,
	"summary_en" text,
	"summary_ta" text,
	"sentiment" text,
	"sentiment_score" integer,
	"topics" text,
	"published_at" timestamp with time zone,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "press_coverage_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_date" timestamp with time zone,
	"due_time" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"category" text DEFAULT 'follow_up' NOT NULL,
	"assigned_to" integer,
	"created_by" integer,
	"linked_entity_type" text,
	"linked_entity_id" integer,
	"reminder_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_no" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"address" text,
	"ward" text,
	"constituency" text,
	"category" text DEFAULT 'General' NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"party_size" integer DEFAULT 1 NOT NULL,
	"preferred_date" timestamp with time zone,
	"preferred_time" text,
	"alternate_date" timestamp with time zone,
	"status" text DEFAULT 'Pending' NOT NULL,
	"scheduled_date" timestamp with time zone,
	"scheduled_time" text,
	"location" text,
	"decision_note" text,
	"rejection_reason" text,
	"handled_by" integer,
	"handled_by_name" text,
	"notification_message" text,
	"notified" boolean DEFAULT false NOT NULL,
	"ai_priority_score" integer,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_ticket_no_unique" UNIQUE("ticket_no")
);
--> statement-breakpoint
ALTER TABLE "grievances" ADD CONSTRAINT "grievances_voter_id_voters_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."voters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voter_imports" ADD CONSTRAINT "voter_imports_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voters" ADD CONSTRAINT "voters_polling_station_id_polling_stations_id_fk" FOREIGN KEY ("polling_station_id") REFERENCES "public"."polling_stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voters" ADD CONSTRAINT "voters_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voter_notes" ADD CONSTRAINT "voter_notes_voter_id_voters_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."voters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voter_notes" ADD CONSTRAINT "voter_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voter_tag_assignments" ADD CONSTRAINT "voter_tag_assignments_voter_id_voters_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."voters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voter_tag_assignments" ADD CONSTRAINT "voter_tag_assignments_tag_id_voter_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."voter_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voter_tag_assignments" ADD CONSTRAINT "voter_tag_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voter_tags" ADD CONSTRAINT "voter_tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voter_contact_log" ADD CONSTRAINT "voter_contact_log_voter_id_voters_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."voters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voter_contact_log" ADD CONSTRAINT "voter_contact_log_contacted_by_users_id_fk" FOREIGN KEY ("contacted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voter_relations" ADD CONSTRAINT "voter_relations_voter_id_voters_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."voters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voter_relations" ADD CONSTRAINT "voter_relations_related_voter_id_voters_id_fk" FOREIGN KEY ("related_voter_id") REFERENCES "public"."voters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voter_relations" ADD CONSTRAINT "voter_relations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voter_segments" ADD CONSTRAINT "voter_segments_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_polling_station_id_polling_stations_id_fk" FOREIGN KEY ("polling_station_id") REFERENCES "public"."polling_stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voter_exports" ADD CONSTRAINT "voter_exports_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_post_targets" ADD CONSTRAINT "social_post_targets_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_post_targets" ADD CONSTRAINT "social_post_targets_account_id_social_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_stats_snapshots" ADD CONSTRAINT "social_stats_snapshots_account_id_social_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grievance_voter_link_log_grievance_idx" ON "grievance_voter_link_log" USING btree ("grievance_id");--> statement-breakpoint
CREATE INDEX "grievances_voter_idx" ON "grievances" USING btree ("voter_id");--> statement-breakpoint
CREATE INDEX "grievances_created_at_idx" ON "grievances" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "grievances_status_created_at_idx" ON "grievances" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "wards_slug_idx" ON "wards" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "wards_zone_idx" ON "wards" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "areas_ward_idx" ON "areas" USING btree ("ward_id");--> statement-breakpoint
CREATE INDEX "polling_stations_booth_idx" ON "polling_stations" USING btree ("booth_no");--> statement-breakpoint
CREATE INDEX "polling_stations_ward_idx" ON "polling_stations" USING btree ("ward_id");--> statement-breakpoint
CREATE INDEX "polling_stations_pincode_idx" ON "polling_stations" USING btree ("pincode");--> statement-breakpoint
CREATE INDEX "streets_area_idx" ON "streets" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "zones_slug_idx" ON "zones" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "grievance_routing_log_grievance_idx" ON "grievance_routing_log" USING btree ("grievance_id");--> statement-breakpoint
CREATE INDEX "officer_assignments_user_idx" ON "officer_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "officer_assignments_ward_idx" ON "officer_assignments" USING btree ("ward_id");--> statement-breakpoint
CREATE INDEX "officer_assignments_area_idx" ON "officer_assignments" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "officer_assignments_booth_idx" ON "officer_assignments" USING btree ("polling_station_id");--> statement-breakpoint
CREATE UNIQUE INDEX "officer_assignments_uniq" ON "officer_assignments" USING btree ("user_id","ward_id","area_id","polling_station_id");--> statement-breakpoint
CREATE INDEX "volunteer_assignments_vol_idx" ON "volunteer_assignments" USING btree ("volunteer_id");--> statement-breakpoint
CREATE INDEX "volunteer_assignments_ward_idx" ON "volunteer_assignments" USING btree ("ward_id");--> statement-breakpoint
CREATE UNIQUE INDEX "volunteer_assignments_uniq" ON "volunteer_assignments" USING btree ("volunteer_id","ward_id","area_id","polling_station_id");--> statement-breakpoint
CREATE INDEX "voter_imports_sha_idx" ON "voter_imports" USING btree ("file_sha256");--> statement-breakpoint
CREATE INDEX "voter_imports_status_idx" ON "voter_imports" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "voters_epic_unique" ON "voters" USING btree ("epic_number");--> statement-breakpoint
CREATE INDEX "voters_booth_idx" ON "voters" USING btree ("polling_station_id");--> statement-breakpoint
CREATE INDEX "voters_name_idx" ON "voters" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "voters_name_trgm_idx" ON "voters" USING gin (lower("full_name") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "voters_part_idx" ON "voters" USING btree ("part_number","serial_in_part");--> statement-breakpoint
CREATE INDEX "voters_household_idx" ON "voters" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "voter_notes_voter_idx" ON "voter_notes" USING btree ("voter_id");--> statement-breakpoint
CREATE INDEX "voter_notes_voter_created_idx" ON "voter_notes" USING btree ("voter_id","created_at");--> statement-breakpoint
CREATE INDEX "voter_tag_assignments_tag_idx" ON "voter_tag_assignments" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "voter_tags_name_unique" ON "voter_tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "voter_contact_log_voter_idx" ON "voter_contact_log" USING btree ("voter_id");--> statement-breakpoint
CREATE INDEX "voter_contact_log_voter_time_idx" ON "voter_contact_log" USING btree ("voter_id","contacted_at");--> statement-breakpoint
CREATE INDEX "voter_contact_log_time_idx" ON "voter_contact_log" USING btree ("contacted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "voter_relations_pair_unique" ON "voter_relations" USING btree ("voter_id","related_voter_id");--> statement-breakpoint
CREATE INDEX "voter_relations_voter_idx" ON "voter_relations" USING btree ("voter_id");--> statement-breakpoint
CREATE INDEX "voter_relations_related_idx" ON "voter_relations" USING btree ("related_voter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "voter_segments_name_unique" ON "voter_segments" USING btree ("name");--> statement-breakpoint
CREATE INDEX "voter_segments_owner_idx" ON "voter_segments" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "households_poll_addr_idx" ON "households" USING btree ("polling_station_id","address_key");--> statement-breakpoint
CREATE INDEX "voter_exports_actor_idx" ON "voter_exports" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "voter_exports_created_idx" ON "voter_exports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "press_coverage_pub_idx" ON "press_coverage" USING btree ("published_at");