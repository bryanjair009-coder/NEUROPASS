Pod::Spec.new do |s|
  s.name           = 'NeuropassScreentime'
  s.version        = '0.1.0'
  s.summary        = 'Puente de Family Controls y Managed Settings para NEUROpass'
  s.license        = 'MIT'
  s.author         = 'NEUROpass'
  s.homepage       = 'https://github.com/neuropass/neuropass'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
