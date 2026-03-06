
-- Create enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.request_type AS ENUM ('access', 'issue', 'information', 'change', 'other');
CREATE TYPE public.source_channel AS ENUM ('email', 'portal', 'chat');
CREATE TYPE public.request_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.request_status AS ENUM ('draft', 'reviewed', 'approved', 'finalized');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Requests table
CREATE TABLE public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requestor_name TEXT NOT NULL DEFAULT '',
  requestor_email TEXT NOT NULL DEFAULT '',
  requestor_employee_id TEXT,
  request_type request_type NOT NULL DEFAULT 'other',
  source_channel source_channel NOT NULL DEFAULT 'portal',
  priority request_priority NOT NULL DEFAULT 'medium',
  status request_status NOT NULL DEFAULT 'draft',
  raw_description TEXT NOT NULL DEFAULT '',
  ai_summary TEXT,
  ai_details TEXT,
  ai_next_action TEXT,
  ai_tags TEXT[],
  final_notes TEXT,
  due_date TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view requests" ON public.requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create requests" ON public.requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can update any request" ON public.requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own requests" ON public.requests FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Admins can delete requests" ON public.requests FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Follow-ups table
CREATE TABLE public.follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  comment TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view follow-ups" ON public.follow_ups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create follow-ups" ON public.follow_ups FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own follow-ups" ON public.follow_ups FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Request number sequence function
CREATE OR REPLACE FUNCTION public.generate_request_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM 5) AS INT)), 0) + 1
  INTO next_num FROM public.requests;
  NEW.request_number := 'REQ-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_request_number
  BEFORE INSERT ON public.requests
  FOR EACH ROW
  WHEN (NEW.request_number IS NULL OR NEW.request_number = '')
  EXECUTE FUNCTION public.generate_request_number();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), NEW.email);
  
  -- Default role is 'user'
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Due date auto-calculation function
CREATE OR REPLACE FUNCTION public.calculate_due_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.due_date IS NULL THEN
    CASE NEW.priority
      WHEN 'high' THEN NEW.due_date := now() + INTERVAL '1 day';
      WHEN 'medium' THEN NEW.due_date := now() + INTERVAL '3 days';
      WHEN 'low' THEN NEW.due_date := now() + INTERVAL '7 days';
    END CASE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_due_date
  BEFORE INSERT ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_due_date();

-- Indexes
CREATE INDEX idx_requests_status ON public.requests(status);
CREATE INDEX idx_requests_priority ON public.requests(priority);
CREATE INDEX idx_requests_created_by ON public.requests(created_by);
CREATE INDEX idx_requests_assigned_to ON public.requests(assigned_to);
CREATE INDEX idx_requests_due_date ON public.requests(due_date);
CREATE INDEX idx_follow_ups_request_id ON public.follow_ups(request_id);
