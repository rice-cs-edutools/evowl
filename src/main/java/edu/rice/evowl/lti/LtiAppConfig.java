package edu.rice.evowl.lti;

import edu.ksu.lti.launch.spring.config.LtiConfigurer;
import edu.ksu.lti.launch.service.ToolConsumerService;
import edu.ksu.lti.launch.service.SingleToolConsumerService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;

@Configuration
@EnableWebSecurity
public class LtiAppConfig extends WebSecurityConfigurerAdapter {

    @Value("${lti.instance:consumer}")
    private String ltiInstance;

    @Value("${lti.secret:secret}")
    private String ltiSecret;

    @Value("${lti.name:LTI Demo}")
    private String ltiName;

    @Value("${lti.url:localhost}")
    private String ltiUrl;

    @Bean
    public ToolConsumerService toolConsumerService() {
        return new SingleToolConsumerService(ltiInstance, ltiName, ltiUrl, ltiSecret);
    }

    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http.authorizeRequests()
                .antMatchers("/lti/configure").permitAll()
                .anyRequest().permitAll() // Use permitAll to allow fallback access when not in Canvas
                .and()
                .apply(new LtiConfigurer<>(toolConsumerService(), "/evowl", false, false, "/"));

        http.cors().and().csrf().disable();
        http.headers().frameOptions().disable();
    }
}
