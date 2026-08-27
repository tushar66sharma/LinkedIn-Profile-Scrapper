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
  // Initialize the clean data structure
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
    if (!rawData || !rawData.included) {
       return profile;
    }

    const included: any[] = rawData.included;

    // The Voyager API returns a flat array of entities in 'included'. We need to filter them by $type.
    
    // 1. Basic Profile Info
    const coreProfile = included.find(item => item.$type === 'com.linkedin.voyager.dash.identity.profile.Profile');
    if (coreProfile) {
      profile.name = `${coreProfile.firstName || ''} ${coreProfile.lastName || ''}`.trim() || null;
      profile.headline = coreProfile.headline || null;
      profile.location = coreProfile.locationName || null;
      profile.about = coreProfile.summary || null;
    }

    // 2. Profile Image
    const picture = included.find(item => item.$type === 'com.linkedin.voyager.dash.identity.profile.PhotoFilterPicture');
    if (picture && picture.rootUrl) {
      // Basic extraction, Voyager images are usually split into rootUrl and artifacts
      profile.profileImage = picture.rootUrl;
    }

    // 3. Experience
    const positions = included.filter(item => item.$type === 'com.linkedin.voyager.dash.identity.profile.Position');
    profile.experience = positions.map(pos => ({
      title: pos.title,
      company: pos.companyName,
      description: pos.description,
      dateRange: pos.dateRange ? `${pos.dateRange.start?.year || ''} - ${pos.dateRange.end?.year || 'Present'}` : null
    }));

    // 4. Education
    const educations = included.filter(item => item.$type === 'com.linkedin.voyager.dash.identity.profile.Education');
    profile.education = educations.map(edu => ({
      school: edu.schoolName,
      degree: edu.degreeName,
      fieldOfStudy: edu.fieldOfStudy,
      dateRange: edu.dateRange ? `${edu.dateRange.start?.year || ''} - ${edu.dateRange.end?.year || ''}` : null
    }));

    // 5. Skills
    const skills = included.filter(item => item.$type === 'com.linkedin.voyager.dash.identity.profile.Skill');
    profile.skills = skills.map(skill => skill.name).filter(Boolean);

    // 6. Certifications
    const certs = included.filter(item => item.$type === 'com.linkedin.voyager.dash.identity.profile.Certification');
    profile.certifications = certs.map(cert => ({
      name: cert.name,
      authority: cert.authority,
      url: cert.url
    }));

    // 7. Languages
    const languages = included.filter(item => item.$type === 'com.linkedin.voyager.dash.identity.profile.Language');
    profile.languages = languages.map(lang => lang.name).filter(Boolean);

    return profile;
  } catch (error) {
    console.error("Error mapping Voyager response:", error);
    return profile; // return whatever we managed to parse
  }
}
