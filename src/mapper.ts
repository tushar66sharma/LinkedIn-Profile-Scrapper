export interface ProfileData {
  name: string | null;
  headline: string | null;
  location: string | null;
  about: string | null;
  profileImage: string | null;
  experience: any[];
  education: any[];
  skills: any[];
  certifications: any[];
  languages: any[];
}

export function mapVoyagerResponse(rawData: any): ProfileData {
  const profile: ProfileData = {
    name: null,
    headline: null,
    location: null,
    about: null,
    profileImage: null,
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: []
  };

  try {
    if (!rawData) return profile;

    // ── The Dash API returns data under rawData.elements[] ──────────────────
    const elements: any[] = rawData.elements || [];
    const coreProfile = elements[0];

    if (!coreProfile) {
      // Fallback: try the old 'included' array (GraphQL response shape)
      return mapFromIncluded(rawData.included || [], profile);
    }

    // ── Basic Info ──────────────────────────────────────────────────────────
    profile.name = `${coreProfile.firstName || ''} ${coreProfile.lastName || ''}`.trim() || null;
    profile.headline = coreProfile.headline || null;
    profile.location = coreProfile.geoLocationName || coreProfile.locationName || null;
    profile.about = coreProfile.summary || null;

    // ── Profile Image ────────────────────────────────────────────────────────
    const photo = coreProfile.profilePicture?.displayImageReference?.vectorImage;
    if (photo?.rootUrl && photo?.artifacts?.length > 0) {
      // Pick the largest artifact
      const largest = photo.artifacts.reduce((prev: any, curr: any) =>
        (curr.width || 0) > (prev.width || 0) ? curr : prev, photo.artifacts[0]);
      profile.profileImage = photo.rootUrl + (largest?.fileIdentifyingUrlPathSegment || '');
    }

    // ── Experience ───────────────────────────────────────────────────────────
    const positions = coreProfile.profilePositionGroups?.elements || [];
    profile.experience = positions.flatMap((group: any) =>
      (group.profilePositionInPositionGroup?.elements || []).map((pos: any) => ({
        title: pos.title || null,
        company: pos.companyName || group.companyName || null,
        description: pos.description || null,
        dateRange: formatDateRange(pos.dateRange)
      }))
    );

    // ── Education ───────────────────────────────────────────────────────────
    const educations = coreProfile.profileEducations?.elements || [];
    profile.education = educations.map((edu: any) => ({
      school: edu.schoolName || null,
      degree: edu.degreeName || null,
      fieldOfStudy: edu.fieldOfStudy || null,
      dateRange: formatDateRange(edu.dateRange)
    }));

    // ── Skills ──────────────────────────────────────────────────────────────
    const skills = coreProfile.profileSkills?.elements || [];
    profile.skills = skills.map((s: any) => s.name).filter(Boolean);

    // ── Certifications ───────────────────────────────────────────────────────
    const certs = coreProfile.profileCertifications?.elements || [];
    profile.certifications = certs.map((c: any) => ({
      name: c.name || null,
      authority: c.authority || null,
      url: c.url || null
    }));

    // ── Languages ─────────────────────────────────────────────────────────────
    const langs = coreProfile.profileLanguages?.elements || [];
    profile.languages = langs.map((l: any) => l.name).filter(Boolean);

    return profile;
  } catch (error) {
    console.error("Error mapping Voyager response:", error);
    return profile;
  }
}

// ── Helper: map the old 'included' array shape (GraphQL fallback) ─────────
function mapFromIncluded(included: any[], profile: ProfileData): ProfileData {
  const coreProfile = included.find((item: any) =>
    item.$type === 'com.linkedin.voyager.dash.identity.profile.Profile'
  );

  if (coreProfile) {
    profile.name = `${coreProfile.firstName || ''} ${coreProfile.lastName || ''}`.trim() || null;
    profile.headline = coreProfile.headline || null;
    profile.location = coreProfile.locationName || null;
    profile.about = coreProfile.summary || null;
  }

  const picture = included.find((item: any) =>
    item.$type === 'com.linkedin.voyager.dash.identity.profile.PhotoFilterPicture'
  );
  if (picture?.rootUrl) profile.profileImage = picture.rootUrl;

  const positions = included.filter((item: any) =>
    item.$type === 'com.linkedin.voyager.dash.identity.profile.Position'
  );
  profile.experience = positions.map((pos: any) => ({
    title: pos.title,
    company: pos.companyName,
    description: pos.description,
    dateRange: formatDateRange(pos.dateRange)
  }));

  const educations = included.filter((item: any) =>
    item.$type === 'com.linkedin.voyager.dash.identity.profile.Education'
  );
  profile.education = educations.map((edu: any) => ({
    school: edu.schoolName,
    degree: edu.degreeName,
    fieldOfStudy: edu.fieldOfStudy,
    dateRange: formatDateRange(edu.dateRange)
  }));

  profile.skills = included
    .filter((item: any) => item.$type === 'com.linkedin.voyager.dash.identity.profile.Skill')
    .map((s: any) => s.name).filter(Boolean);

  profile.certifications = included
    .filter((item: any) => item.$type === 'com.linkedin.voyager.dash.identity.profile.Certification')
    .map((c: any) => ({ name: c.name, authority: c.authority, url: c.url }));

  profile.languages = included
    .filter((item: any) => item.$type === 'com.linkedin.voyager.dash.identity.profile.Language')
    .map((l: any) => l.name).filter(Boolean);

  return profile;
}

// ── Helper: format a LinkedIn dateRange object into a readable string ─────
function formatDateRange(dateRange: any): string | null {
  if (!dateRange) return null;
  const start = dateRange.start?.year ? String(dateRange.start.year) : '';
  const end = dateRange.end?.year ? String(dateRange.end.year) : 'Present';
  return start ? `${start} – ${end}` : null;
}
