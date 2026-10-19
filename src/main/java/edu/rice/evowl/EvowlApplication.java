package edu.rice.evowl;

import edu.ksu.lti.launch.service.LtiLoginService;
import edu.ksu.lti.launch.service.SimpleLtiLoginService;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.support.SpringBootServletInitializer;
import org.springframework.context.annotation.Bean;
import springfox.documentation.swagger2.annotations.EnableSwagger2;

@EnableSwagger2
@SpringBootApplication
@MapperScan("edu.rice.evowl.mapper")
public class EvowlApplication extends SpringBootServletInitializer {

  @Override
  protected SpringApplicationBuilder configure(
    SpringApplicationBuilder builder
  ) {
    return builder.sources(EvowlApplication.class);
  }

  @Bean
  public LtiLoginService ltiLoginService() {
    return new SimpleLtiLoginService();
  }

  public static void main(String[] args) {
    SpringApplication.run(EvowlApplication.class, args);
  }
}
